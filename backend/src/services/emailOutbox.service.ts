import { Prisma, PrismaClient } from '@prisma/client';
import { log } from '../config/logger';
import { EMAIL_CLEANUP_INTERVAL_MS } from './emailQueuePolicy';

const prisma = new PrismaClient();
export { prisma as emailOutboxPrisma };
const LEASE_MS = 60_000;
const ENQUEUE_TIMEOUT_MS = 15_000;
const POLL_MS = 5_000;
export const MAX_ATTEMPTS = 20;
const BATCH_SIZE = 25;

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
export type EmailEnqueue = (payload: EmailPayload, jobId: string) => Promise<unknown>;

export const persistEmailEvent = (
  tx: Prisma.TransactionClient | PrismaClient,
  event: {
    eventType: string;
    aggregateId: string;
    deduplicationKey: string;
    payload: EmailPayload;
  },
) => tx.emailOutboxEvent.upsert({
  where: { deduplicationKey: event.deduplicationKey },
  create: { ...event, payload: event.payload as unknown as Prisma.InputJsonValue },
  update: {},
});

const enqueueWithTimeout = async (enqueue: EmailEnqueue, payload: EmailPayload, jobId: string) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => enqueue(payload, jobId)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('EMAIL_ENQUEUE_TIMEOUT')), ENQUEUE_TIMEOUT_MS);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const dispatchEmailOutboxEvent = async (id: string, enqueue: EmailEnqueue): Promise<boolean> => {
  const lockedAt = new Date();
  const claimed = await prisma.emailOutboxEvent.updateMany({
    where: { id, status: 'pending', processedAt: null, nextAttemptAt: { lte: lockedAt }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: 'processing', lockedAt, attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;

  const ownership = { id, status: 'processing', lockedAt, processedAt: null };
  let attempts: number | undefined;
  try {
    const event = await prisma.emailOutboxEvent.findUnique({ where: { id } });
    if (!event || event.lockedAt?.getTime() !== lockedAt.getTime() || event.status !== 'processing') return false;
    attempts = event.attempts;
    const payload = event.payload as unknown as EmailPayload;
    if (!payload || typeof payload.to !== 'string' || typeof payload.subject !== 'string'
      || typeof payload.html !== 'string' || (payload.text !== undefined && typeof payload.text !== 'string')) {
      attempts = MAX_ATTEMPTS;
      throw new Error('EMAIL_PAYLOAD_INVALID');
    }
    // A late Redis success after timeout and a crash before this DB ACK both
    // replay the same retained Bull job, never a freshly generated identity.
    await enqueueWithTimeout(enqueue, payload, `email-outbox-${id}`);
    const acknowledged = await prisma.emailOutboxEvent.updateMany({
      where: ownership,
      data: { status: 'dispatched', processedAt: new Date(), lockedAt: null, lastError: null },
    });
    return acknowledged.count === 1;
  } catch {
    // If reading the claimed row failed, preserve the lease; recovery can read
    // its real attempt count later instead of incorrectly making it permanent.
    if (attempts === undefined) throw new Error('EMAIL_DISPATCH_READ_FAILED');
    const failed = attempts >= MAX_ATTEMPTS;
    await prisma.emailOutboxEvent.updateMany({
      where: ownership,
      data: {
        status: failed ? 'failed' : 'pending', lockedAt: null,
        nextAttemptAt: new Date(Date.now() + Math.min(300_000, 1_000 * 2 ** Math.min(attempts, 9))),
        lastError: failed ? 'EMAIL_DISPATCH_REQUIRES_REVIEW' : 'EMAIL_ENQUEUE_OR_ACK_FAILED',
      },
    });
    if (failed) log.error('Email outbox event requires review', { eventId: id });
    return false;
  }
};

export const dispatchEmailOutboxOnce = async (enqueue: EmailEnqueue): Promise<void> => {
  const staleBefore = new Date(Date.now() - LEASE_MS);
  // Bounded stale recovery, with CAS on the original lease to avoid undoing a
  // concurrent owner's claim. Events and failed payloads are retained for review.
  const stale = await prisma.emailOutboxEvent.findMany({
    where: { status: 'processing', processedAt: null, lockedAt: { lt: staleBefore } },
    select: { id: true, lockedAt: true, attempts: true }, orderBy: { lockedAt: 'asc' }, take: BATCH_SIZE,
  });
  for (const event of stale) {
    await prisma.emailOutboxEvent.updateMany({
      where: { id: event.id, status: 'processing', lockedAt: event.lockedAt, processedAt: null },
      data: { status: event.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', lockedAt: null,
        nextAttemptAt: new Date(), lastError: 'EMAIL_DISPATCH_LEASE_EXPIRED' },
    });
  }
  const events = await prisma.emailOutboxEvent.findMany({
    where: { status: 'pending', processedAt: null, nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    select: { id: true }, orderBy: { nextAttemptAt: 'asc' }, take: BATCH_SIZE,
  });
  await Promise.all(events.map(async ({ id }) => {
    try { await dispatchEmailOutboxEvent(id, enqueue); }
    catch { log.error('Email outbox dispatch DB operation failed', { eventId: id }); }
  }));
};

let poll: NodeJS.Timeout | undefined;
let running = false;
export const startEmailOutboxDispatcher = (enqueue: EmailEnqueue, cleanup?: () => Promise<void>): void => {
  if (poll) return;
  let nextCleanupAt = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await dispatchEmailOutboxOnce(enqueue);
      if (cleanup && Date.now() >= nextCleanupAt) {
        nextCleanupAt = Date.now() + EMAIL_CLEANUP_INTERVAL_MS;
        try { await cleanup(); }
        catch { log.error('Email retention cleanup failed'); }
      }
    }
    catch { log.error('Email outbox polling failed'); }
    finally { running = false; }
  };
  poll = setInterval(() => { void tick(); }, POLL_MS);
  poll.unref();
  void tick();
};

export const stopEmailOutboxDispatcher = (): void => {
  if (poll) clearInterval(poll);
  poll = undefined;
};
