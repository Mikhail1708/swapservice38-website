"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopEmailOutboxDispatcher = exports.startEmailOutboxDispatcher = exports.dispatchEmailOutboxOnce = exports.dispatchEmailOutboxEvent = exports.persistEmailEvent = exports.MAX_ATTEMPTS = exports.emailOutboxPrisma = void 0;
const logger_1 = require("../config/logger");
const emailQueuePolicy_1 = require("./emailQueuePolicy");
const prisma_1 = require("../config/prisma");
Object.defineProperty(exports, "emailOutboxPrisma", { enumerable: true, get: function () { return prisma_1.prisma; } });
const LEASE_MS = 60000;
const ENQUEUE_TIMEOUT_MS = 15000;
const POLL_MS = 5000;
exports.MAX_ATTEMPTS = 20;
const BATCH_SIZE = 25;
const persistEmailEvent = (tx, event) => tx.emailOutboxEvent.upsert({
    where: { deduplicationKey: event.deduplicationKey },
    create: { ...event, payload: event.payload },
    update: {},
});
exports.persistEmailEvent = persistEmailEvent;
const enqueueWithTimeout = async (enqueue, payload, jobId) => {
    let timer;
    try {
        await Promise.race([
            Promise.resolve().then(() => enqueue(payload, jobId)),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('EMAIL_ENQUEUE_TIMEOUT')), ENQUEUE_TIMEOUT_MS);
                timer.unref();
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
};
const dispatchEmailOutboxEvent = async (id, enqueue) => {
    const lockedAt = new Date();
    const claimed = await prisma_1.prisma.emailOutboxEvent.updateMany({
        where: { id, status: 'pending', processedAt: null, nextAttemptAt: { lte: lockedAt }, attempts: { lt: exports.MAX_ATTEMPTS } },
        data: { status: 'processing', lockedAt, attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const ownership = { id, status: 'processing', lockedAt, processedAt: null };
    let attempts;
    try {
        const event = await prisma_1.prisma.emailOutboxEvent.findUnique({ where: { id } });
        if (!event || event.lockedAt?.getTime() !== lockedAt.getTime() || event.status !== 'processing')
            return false;
        attempts = event.attempts;
        const payload = event.payload;
        if (!payload || typeof payload.to !== 'string' || typeof payload.subject !== 'string'
            || typeof payload.html !== 'string' || (payload.text !== undefined && typeof payload.text !== 'string')) {
            attempts = exports.MAX_ATTEMPTS;
            throw new Error('EMAIL_PAYLOAD_INVALID');
        }
        // A late Redis success after timeout and a crash before this DB ACK both
        // replay the same retained Bull job, never a freshly generated identity.
        await enqueueWithTimeout(enqueue, payload, `email-outbox-${id}`);
        const acknowledged = await prisma_1.prisma.emailOutboxEvent.updateMany({
            where: ownership,
            data: { status: 'dispatched', processedAt: new Date(), lockedAt: null, lastError: null },
        });
        return acknowledged.count === 1;
    }
    catch {
        // If reading the claimed row failed, preserve the lease; recovery can read
        // its real attempt count later instead of incorrectly making it permanent.
        if (attempts === undefined)
            throw new Error('EMAIL_DISPATCH_READ_FAILED');
        const failed = attempts >= exports.MAX_ATTEMPTS;
        await prisma_1.prisma.emailOutboxEvent.updateMany({
            where: ownership,
            data: {
                status: failed ? 'failed' : 'pending', lockedAt: null,
                nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 9))),
                lastError: failed ? 'EMAIL_DISPATCH_REQUIRES_REVIEW' : 'EMAIL_ENQUEUE_OR_ACK_FAILED',
            },
        });
        if (failed)
            logger_1.log.error('Email outbox event requires review', { eventId: id });
        return false;
    }
};
exports.dispatchEmailOutboxEvent = dispatchEmailOutboxEvent;
const dispatchEmailOutboxOnce = async (enqueue) => {
    const staleBefore = new Date(Date.now() - LEASE_MS);
    // Bounded stale recovery, with CAS on the original lease to avoid undoing a
    // concurrent owner's claim. Events and failed payloads are retained for review.
    const stale = await prisma_1.prisma.emailOutboxEvent.findMany({
        where: { status: 'processing', processedAt: null, lockedAt: { lt: staleBefore } },
        select: { id: true, lockedAt: true, attempts: true }, orderBy: { lockedAt: 'asc' }, take: BATCH_SIZE,
    });
    for (const event of stale) {
        await prisma_1.prisma.emailOutboxEvent.updateMany({
            where: { id: event.id, status: 'processing', lockedAt: event.lockedAt, processedAt: null },
            data: { status: event.attempts >= exports.MAX_ATTEMPTS ? 'failed' : 'pending', lockedAt: null,
                nextAttemptAt: new Date(), lastError: 'EMAIL_DISPATCH_LEASE_EXPIRED' },
        });
    }
    const events = await prisma_1.prisma.emailOutboxEvent.findMany({
        where: { status: 'pending', processedAt: null, nextAttemptAt: { lte: new Date() }, attempts: { lt: exports.MAX_ATTEMPTS } },
        select: { id: true }, orderBy: { nextAttemptAt: 'asc' }, take: BATCH_SIZE,
    });
    await Promise.all(events.map(async ({ id }) => {
        try {
            await (0, exports.dispatchEmailOutboxEvent)(id, enqueue);
        }
        catch {
            logger_1.log.error('Email outbox dispatch DB operation failed', { eventId: id });
        }
    }));
};
exports.dispatchEmailOutboxOnce = dispatchEmailOutboxOnce;
let poll;
let running = false;
const startEmailOutboxDispatcher = (enqueue, cleanup) => {
    if (poll)
        return;
    let nextCleanupAt = 0;
    const tick = async () => {
        if (running)
            return;
        running = true;
        try {
            await (0, exports.dispatchEmailOutboxOnce)(enqueue);
            if (cleanup && Date.now() >= nextCleanupAt) {
                nextCleanupAt = Date.now() + emailQueuePolicy_1.EMAIL_CLEANUP_INTERVAL_MS;
                try {
                    await cleanup();
                }
                catch {
                    logger_1.log.error('Email retention cleanup failed');
                }
            }
        }
        catch {
            logger_1.log.error('Email outbox polling failed');
        }
        finally {
            running = false;
        }
    };
    poll = setInterval(() => { void tick(); }, POLL_MS);
    poll.unref();
    void tick();
};
exports.startEmailOutboxDispatcher = startEmailOutboxDispatcher;
const stopEmailOutboxDispatcher = () => {
    if (poll)
        clearInterval(poll);
    poll = undefined;
};
exports.stopEmailOutboxDispatcher = stopEmailOutboxDispatcher;
//# sourceMappingURL=emailOutbox.service.js.map