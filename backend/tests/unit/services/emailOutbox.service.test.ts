import { PrismaClient } from '@prisma/client';
import {
  dispatchEmailOutboxEvent, dispatchEmailOutboxOnce, persistEmailEvent,
} from '../../../src/services/emailOutbox.service';

const prisma = new PrismaClient() as any;
const payload = { to: 'customer@example.test', subject: 'Order', html: '<p>Order</p>', text: 'Order' };
const intent = { eventType: 'order-created', aggregateId: 'order-1', deduplicationKey: 'order-created:order-1:customer', payload };

describe('email transactional outbox', () => {
  let rows: Map<string, any>;
  let now: number;
  const matches = (row: any, where: any) => Object.entries(where).every(([key, expected]: [string, any]) => {
    const value = row[key];
    if (expected instanceof Date) return value?.getTime() === expected.getTime();
    if (expected && typeof expected === 'object') {
      if ('lt' in expected) return value !== null && value < expected.lt;
      if ('lte' in expected) return value <= expected.lte;
    }
    return value === expected;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    now = Date.now();
    rows = new Map();
    prisma.emailOutboxEvent = {
      upsert: jest.fn(async ({ where, create }: any) => {
        const existing = [...rows.values()].find(row => row.deduplicationKey === where.deduplicationKey);
        if (existing) return existing;
        const row = { ...create, id: `event-${rows.size + 1}`, status: 'pending', attempts: 0,
          nextAttemptAt: new Date(now - 1000), lockedAt: null, processedAt: null, lastError: null };
        rows.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = rows.get(where.id);
        return row ? { ...row } : null;
      }),
      findMany: jest.fn(async ({ where, take }: any) => [...rows.values()].filter(row => matches(row, where)).slice(0, take).map(row => ({ ...row }))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of rows.values()) {
          if (!matches(row, where)) continue;
          for (const [key, value] of Object.entries(data) as [string, any][]) {
            row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
          }
          count++;
        }
        return { count };
      }),
    };
  });

  it('persists business intent through the supplied transaction and deduplicates immutable payload', async () => {
    const first = await persistEmailEvent(prisma, intent);
    const second = await persistEmailEvent(prisma, { ...intent, payload: { ...payload, subject: 'changed' } });
    expect(first.id).toBe(second.id);
    expect(rows.size).toBe(1);
    expect(second.payload).toEqual(payload);
    expect(prisma.emailOutboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it('recovers committed pending intent after process crash before any enqueue', async () => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn().mockResolvedValue({ id: 'email-outbox-event-1' });
    expect(rows.get('event-1').status).toBe('pending');
    await dispatchEmailOutboxOnce(enqueue);
    expect(enqueue).toHaveBeenCalledWith(payload, 'email-outbox-event-1');
    expect(rows.get('event-1').status).toBe('dispatched');
    expect(rows.get('event-1').processedAt).toBeInstanceOf(Date);
  });

  it('keeps Redis failure retryable with backoff and dispatches after recovery', async () => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn().mockRejectedValueOnce(new Error('secret Redis URL')).mockResolvedValueOnce({});
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(false);
    const row = rows.get('event-1');
    expect(row.status).toBe('pending');
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(now);
    expect(row.lastError).not.toContain('secret');
    expect(row.processedAt).toBeNull();
    row.nextAttemptAt = new Date(now - 1);
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(true);
    expect(enqueue.mock.calls.map(call => call[1])).toEqual(['email-outbox-event-1', 'email-outbox-event-1']);
  });

  it.each(['NOAUTH Authentication required', 'WRONGPASS invalid username-password pair'])('F21 auth rejection stays retryable: %s', async message => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({});
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(false);
    const row = rows.get('event-1');
    expect(row.status).toBe('pending');
    expect(row.processedAt).toBeNull();
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(now);
    expect(row.lastError).toBe('EMAIL_ENQUEUE_OR_ACK_FAILED');
    row.nextAttemptAt = new Date(now - 1);
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(true);
    expect(enqueue.mock.calls[0][1]).toBe(enqueue.mock.calls[1][1]);
  });

  it('two concurrent dispatcher claims enqueue only one logical job', async () => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn().mockResolvedValue({});
    const results = await Promise.all([dispatchEmailOutboxEvent('event-1', enqueue), dispatchEmailOutboxEvent('event-1', enqueue)]);
    expect(results.sort()).toEqual([false, true]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(rows.get('event-1').attempts).toBe(1);
  });

  it('does not reenqueue an already dispatched event', async () => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn().mockResolvedValue({});
    await dispatchEmailOutboxEvent('event-1', enqueue);
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(false);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('replays stale claim after enqueue-before-DB-ACK crash using retained job identity', async () => {
    await persistEmailEvent(prisma, intent);
    const row = rows.get('event-1');
    row.status = 'processing'; row.attempts = 1; row.lockedAt = new Date(now - 70_000);
    const retainedJobs = new Set(['email-outbox-event-1']);
    const enqueue = jest.fn(async (_: any, id: string) => { retainedJobs.add(id); });
    await dispatchEmailOutboxOnce(enqueue);
    expect(retainedJobs.size).toBe(1);
    expect(row.status).toBe('dispatched');
    expect(row.attempts).toBe(2);
  });

  it('does not recover a currently owned live lease', async () => {
    await persistEmailEvent(prisma, intent);
    Object.assign(rows.get('event-1'), { status: 'processing', lockedAt: new Date(now), attempts: 1 });
    const enqueue = jest.fn();
    await dispatchEmailOutboxOnce(enqueue);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('retains exhausted failures for review rather than retrying or deleting forever', async () => {
    await persistEmailEvent(prisma, intent);
    rows.get('event-1').attempts = 19;
    const enqueue = jest.fn().mockRejectedValue(new Error('Redis down'));
    await dispatchEmailOutboxEvent('event-1', enqueue);
    expect(rows.get('event-1').status).toBe('failed');
    expect(rows.get('event-1').payload).toEqual(payload);
    await dispatchEmailOutboxOnce(enqueue);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('moves an exhausted stale lease to durable failed state', async () => {
    await persistEmailEvent(prisma, intent);
    Object.assign(rows.get('event-1'), { status: 'processing', lockedAt: new Date(now - 70_000), attempts: 20 });
    const enqueue = jest.fn();
    await dispatchEmailOutboxOnce(enqueue);
    expect(rows.get('event-1').status).toBe('failed');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not acknowledge another owner after lease recovery', async () => {
    await persistEmailEvent(prisma, intent);
    const enqueue = jest.fn(async () => {
      rows.get('event-1').lockedAt = new Date(Date.now() + 60_001);
    });
    expect(await dispatchEmailOutboxEvent('event-1', enqueue)).toBe(false);
    expect(rows.get('event-1').processedAt).toBeNull();
  });

  it('bounds a hanging enqueue and preserves late-success identity for retry', async () => {
    jest.useFakeTimers();
    try {
      await persistEmailEvent(prisma, intent);
      const enqueue = jest.fn(() => new Promise(() => undefined));
      const dispatch = dispatchEmailOutboxEvent('event-1', enqueue);
      await jest.advanceTimersByTimeAsync(15_001);
      expect(await dispatch).toBe(false);
      expect(rows.get('event-1').status).toBe('pending');
      expect(enqueue).toHaveBeenCalledWith(payload, 'email-outbox-event-1');
    } finally { jest.useRealTimers(); }
  });
});
