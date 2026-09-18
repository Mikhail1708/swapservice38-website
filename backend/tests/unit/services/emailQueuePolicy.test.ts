import { PrismaClient } from '@prisma/client';
import {
  claimSmtpAttempt, createEmailCleanup, CLAIM_SMTP_ATTEMPT, REMOVE_COMPLETED_EMAIL,
  EMAIL_MAX_ATTEMPTS, EMAIL_OUTBOX_MAX_ATTEMPTS, EMAIL_RETENTION_MS, EMAIL_CLEANUP_BATCH_SIZE,
} from '../../../src/services/emailQueuePolicy';
import { startEmailOutboxDispatcher, stopEmailOutboxDispatcher } from '../../../src/services/emailOutbox.service';

describe('F22 SITE bounded SMTP budget', () => {
  it('uses installed Bull exponential backoff: 5, 15, 35, 75 seconds', () => {
    const backoffs = require('bull/lib/backoffs');
    expect([1, 2, 3, 4].map(n => backoffs.calculate({ type: 'exponential', delay: 5000 }, n, {}))).toEqual([5000, 15000, 35000, 75000]);
  });
  it('two competing owners cannot both claim the SMTP budget', async () => {
    let count = 0;
    const client = { eval: jest.fn(async (_script, _keys, _key, _lock, owner) => owner === 'current' ? ++count : -1) };
    const job: any = { id: 'direct', discard: jest.fn() };
    const queues = ['current', 'stale'].map(token => ({ token, toKey: () => 'job', client }));
    const results = await Promise.allSettled(queues.map(q => claimSmtpAttempt(q as any, job)));
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']); expect(count).toBe(1);
  });
  it('production processor sends at most five times, keeps terminal failure, and preserves queue backoff', async () => {
    let q: any, mailer: any, service: any, processor: any;
    jest.isolateModules(() => {
      service = jest.requireActual('../../../src/services/email.service');
      const Bull = require('bull'); q = Bull.mock.results[Bull.mock.results.length - 1].value;
      const nodemailer = require('nodemailer'); mailer = nodemailer.createTransport.mock.results[nodemailer.createTransport.mock.results.length - 1].value;
      processor = q.process.mock.calls[0][0];
    });
    let claims = 0;
    q.token = 'owner'; q.toKey = (id: string) => id;
    q.client = { eval: jest.fn(async () => claims >= EMAIL_OUTBOX_MAX_ATTEMPTS ? 0 : ++claims) };
    mailer.sendMail.mockClear(); mailer.sendMail.mockRejectedValue(new Error('fixture SMTP rejection'));
    const job = { id: 'email-outbox-fixture', data: { to: 'test@example.test', subject: 'Test', html: '<p>Test</p>' }, discard: jest.fn() };
    try {
      for (let i = 0; i < EMAIL_OUTBOX_MAX_ATTEMPTS; i++) await expect(processor(job)).rejects.toThrow('fixture SMTP rejection');
      await expect(processor(job)).rejects.toThrow('EMAIL_SMTP_ATTEMPTS_EXHAUSTED');
      expect(mailer.sendMail).toHaveBeenCalledTimes(EMAIL_OUTBOX_MAX_ATTEMPTS); expect(job.discard).toHaveBeenCalledTimes(1);
      await service.enqueueOutboxEmail(job.data, job.id);
      expect(q.add).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: false, removeOnFail: false }));
      await service.sendEmail('test@example.test', 'Test', '<p>Test</p>');
      expect(q.add).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }));
    } finally { mailer.sendMail.mockResolvedValue({ messageId: 'fixture' }); }
  });
  for (const [id, max] of [['direct', EMAIL_MAX_ATTEMPTS], ['email-outbox-event', EMAIL_OUTBOX_MAX_ATTEMPTS]] as const) {
    it(`caps all claims including crash recovery at ${max} for ${id}`, async () => {
      let count = 0;
      const q: any = { token: 'owner', toKey: (id: string) => `queue:${id}`, client: { eval: jest.fn(async (script, keys, key, lock, token, limit) => {
        expect(script).toBe(CLAIM_SMTP_ATTEMPT); expect(keys).toBe(2); expect(lock).toBe(`${key}:lock`); expect(token).toBe('owner'); expect(limit).toBe(max);
        return count >= limit ? 0 : ++count;
      }) } };
      const job: any = { id, discard: jest.fn() };
      for (let attempt = 0; attempt < max; attempt++) await claimSmtpAttempt(q, job);
      await expect(claimSmtpAttempt(q, job)).rejects.toThrow('EMAIL_SMTP_ATTEMPTS_EXHAUSTED');
      await expect(claimSmtpAttempt(q, job)).rejects.toThrow('EMAIL_SMTP_ATTEMPTS_EXHAUSTED');
      expect(count).toBe(max); expect(job.discard).toHaveBeenCalledTimes(2);
    });
  }
  it('checks ownership and retains pre-deployment Bull failed/stalled attempt budget', () => {
    expect(CLAIM_SMTP_ATTEMPT).toContain("redis.call('GET', KEYS[2]) ~= ARGV[1]");
    expect(CLAIM_SMTP_ATTEMPT).toContain("'attemptsMade'"); expect(CLAIM_SMTP_ATTEMPT).toContain("'stalledCounter'");
    expect(CLAIM_SMTP_ATTEMPT).toContain("'smtpAttempts', count + 1");
  });
  it('rejects stale owner before SMTP and does not discard the current owner job', async () => {
    const job: any = { id: 'event', discard: jest.fn() };
    await expect(claimSmtpAttempt({ token: 'old', toKey: () => 'key', client: { eval: async () => -1 } } as any, job)).rejects.toThrow('EMAIL_WORKER_LOCK_LOST');
    expect(job.discard).not.toHaveBeenCalled();
  });
});

describe('F22 paired completed retention', () => {
  function fixture(records: any[], events: any[]) {
    const now = Date.now(), cutoff = now - EMAIL_RETENTION_MS;
    const rows = new Map(events.map(e => [e.id, e]));
    const jobs = new Map(records.map(r => [r.id, { state: 'completed', finishedOn: cutoff - 1, ...r }]));
    const db: any = { emailOutboxEvent: {
      deleteMany: jest.fn(async ({ where }: any) => {
        expect(where).toEqual({ id: expect.any(String), status: 'dispatched', processedAt: { lt: expect.any(Date) }, lockedAt: null });
        const r = rows.get(where.id);
        if (r?.status === where.status && r.processedAt < where.processedAt.lt && r.lockedAt === null) { rows.delete(r.id); return { count: 1 }; }
        return { count: 0 };
      }), findUnique: jest.fn(async ({ where }: any) => rows.get(where.id) || null),
    } };
    const q: any = { toKey: (id: string) => `queue:${id}`, getJob: jest.fn(async (id: string) => {
      const r = jobs.get(id); return r && { ...r, isCompleted: async () => r.state === 'completed' };
    }), client: {
      zrangebyscore: jest.fn(async (_key, min, max, command, offset, batch) => {
        expect(command).toBe('LIMIT'); expect(batch).toBe(EMAIL_CLEANUP_BATCH_SIZE);
        return [...jobs.values()].filter(r => r.state === 'completed' && r.finishedOn < Number(max.slice(1))).slice(offset, offset + batch).map(r => r.id);
      }),
      eval: jest.fn(async (script, n, completed, key, logs, lock, id, cutoff) => {
        expect(script).toBe(REMOVE_COMPLETED_EMAIL); expect(n).toBe(4); expect(logs).toBe(`${key}:logs`); expect(lock).toBe(`${key}:lock`);
        const r = jobs.get(id); if (!r || r.state !== 'completed' || r.finishedOn >= cutoff || r.locked) return 0;
        jobs.delete(id); return 1;
      }),
    } };
    return { q, db, rows, jobs, cutoff, cleanup: createEmailCleanup(q, db) };
  }
  it('deletes paired old successes and direct successes but keeps all unfinished states and fresh completions', async () => {
    const old = new Date(Date.now() - EMAIL_RETENTION_MS - 10000);
    const states = ['pending', 'processing', 'failed', 'dispatched'];
    const f = fixture([
      ...states.map(state => ({ id: `email-outbox-${state}` })), { id: 'direct' }, { id: 'fresh', finishedOn: Date.now() },
      { id: 'failed-smtp', state: 'failed' }, { id: 'active', state: 'active' }, { id: 'waiting', state: 'waiting' },
      { id: 'email-outbox-smtp-failed', state: 'failed' },
    ], [...states.map(status => ({ id: status, status, processedAt: old, lockedAt: status === 'processing' ? new Date() : null })),
      { id: 'smtp-failed', status: 'dispatched', processedAt: old, lockedAt: null }]);
    await f.cleanup();
    expect(f.jobs.has('email-outbox-dispatched')).toBe(false); expect(f.rows.has('dispatched')).toBe(false); expect(f.jobs.has('direct')).toBe(false);
    for (const state of ['pending', 'processing', 'failed']) { expect(f.rows.has(state)).toBe(true); expect(f.jobs.has(`email-outbox-${state}`)).toBe(true); }
    for (const id of ['fresh', 'failed-smtp', 'active', 'waiting', 'email-outbox-smtp-failed']) expect(f.jobs.has(id)).toBe(true);
    expect(f.rows.has('smtp-failed')).toBe(true);
  });
  it('bounds deletion and advances past a blocked batch', async () => {
    const blocked = Array.from({ length: EMAIL_CLEANUP_BATCH_SIZE }, (_, i) => ({ id: `email-outbox-${i}` }));
    const f = fixture([...blocked, { id: 'eligible' }], blocked.map((_, i) => ({ id: String(i), status: 'failed', lockedAt: null })));
    await f.cleanup(); expect(f.q.getJob).toHaveBeenCalledTimes(EMAIL_CLEANUP_BATCH_SIZE); expect(f.jobs.has('eligible')).toBe(true);
    await f.cleanup(); expect(f.jobs.has('eligible')).toBe(false); expect(f.rows.size).toBe(EMAIL_CLEANUP_BATCH_SIZE);
  });
  it('preserves completed Bull barrier while DB ACK is fresh', async () => {
    const f = fixture([{ id: 'email-outbox-new' }], [{ id: 'new', status: 'dispatched', processedAt: new Date(), lockedAt: null }]);
    await f.cleanup(); expect(f.jobs.size).toBe(1); expect(f.rows.size).toBe(1);
  });
  it('DB failure leaves Redis job untouched', async () => {
    const f = fixture([{ id: 'email-outbox-event' }], []); f.db.emailOutboxEvent.deleteMany.mockRejectedValue(new Error('DB unavailable'));
    await expect(f.cleanup()).rejects.toThrow('DB unavailable'); expect(f.jobs.size).toBe(1); expect(f.q.client.eval).not.toHaveBeenCalled();
  });
  it('recovers interruption after DB delete and before Redis removal', async () => {
    const f = fixture([{ id: 'email-outbox-event' }], [{ id: 'event', status: 'dispatched', processedAt: new Date(0), lockedAt: null }]);
    f.q.client.eval.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(f.cleanup()).rejects.toThrow('Redis unavailable'); expect(f.rows.size).toBe(0); expect(f.jobs.size).toBe(1);
    await f.cleanup(); expect(f.jobs.size).toBe(0);
  });
  it('Redis deletion checks completed timestamp and lock atomically', () => {
    expect(REMOVE_COMPLETED_EMAIL).toContain("redis.call('ZSCORE'"); expect(REMOVE_COMPLETED_EMAIL).toContain("redis.call('EXISTS', KEYS[4])");
    expect(REMOVE_COMPLETED_EMAIL).toContain("'finishedOn'"); expect(REMOVE_COMPLETED_EMAIL).not.toContain("'failed'");
  });
  it('cleanup failure is isolated and throttled in existing dispatcher lifecycle', async () => {
    jest.useFakeTimers(); const prisma = new PrismaClient() as any;
    prisma.emailOutboxEvent.findMany.mockResolvedValue([]);
    const cleanup = jest.fn().mockRejectedValue(new Error('cleanup error'));
    try { startEmailOutboxDispatcher(jest.fn(), cleanup); await jest.advanceTimersByTimeAsync(10001);
      expect(cleanup).toHaveBeenCalledTimes(1); expect(prisma.emailOutboxEvent.findMany.mock.calls.length).toBeGreaterThanOrEqual(6);
    } finally { stopEmailOutboxDispatcher(); jest.useRealTimers(); }
  });
});
