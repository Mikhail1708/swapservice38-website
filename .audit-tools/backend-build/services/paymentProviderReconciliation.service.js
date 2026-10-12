"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchPaymentProviderReconciliationEvent = exports.scanPaymentProviderReconciliationAttempts = exports.ensurePaymentProviderReconciliationEvent = exports.PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS = exports.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE = void 0;
const prisma_1 = require("../config/prisma");
const payment_service_1 = require("./payment.service");
const paymentValidation_service_1 = require("./paymentValidation.service");
const paymentWorkflowLock_service_1 = require("./paymentWorkflowLock.service");
exports.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE = 'payment_provider_reconciliation_requested';
exports.PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS = 48;
const unresolvedStatuses = ['initiating', 'pending', 'unknown'];
const recoverableStatuses = [...unresolvedStatuses, 'succeeded'];
const retryDelayMs = (attempts) => Math.min(3600000, 30000 * 2 ** Math.min(attempts - 1, 7));
const ensurePaymentProviderReconciliationEvent = (db, attempt) => {
    if (!attempt.providerPaymentId)
        throw new Error('Provider reconciliation requires a durable payment ID');
    const deduplicationKey = `payment-provider-reconciliation:${attempt.id}:${attempt.providerPaymentId}`;
    return db.outboxEvent.upsert({
        where: { deduplicationKey },
        create: {
            aggregateId: attempt.orderId, type: exports.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE,
            deduplicationKey,
            payload: { orderId: attempt.orderId, attemptId: attempt.id, paymentId: attempt.providerPaymentId },
        },
        // Terminal failures need operator review; scans must never reset the budget.
        update: {},
    });
};
exports.ensurePaymentProviderReconciliationEvent = ensurePaymentProviderReconciliationEvent;
let scanCursor;
const scanPaymentProviderReconciliationAttempts = async (limit = 50) => {
    const take = Math.max(1, Math.min(200, Math.floor(limit) || 50));
    const attempts = await prisma_1.prisma.paymentAttempt.findMany({
        where: {
            providerPaymentId: { not: null },
            ...(scanCursor ? { id: { gt: scanCursor } } : {}),
            OR: [
                { status: { in: unresolvedStatuses } },
                { status: 'succeeded', order: { status: 'pending' } },
            ],
        },
        orderBy: { id: 'asc' }, take,
        select: { id: true, orderId: true, providerPaymentId: true },
    });
    for (const attempt of attempts)
        await (0, exports.ensurePaymentProviderReconciliationEvent)(prisma_1.prisma, attempt);
    scanCursor = attempts.length === take ? attempts[attempts.length - 1].id : undefined;
    return attempts.length;
};
exports.scanPaymentProviderReconciliationAttempts = scanPaymentProviderReconciliationAttempts;
const dispatchPaymentProviderReconciliationEvent = async (eventId) => {
    const now = new Date();
    await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId, type: exports.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE,
            status: 'pending', processedAt: null,
            attempts: { gte: exports.PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS },
        },
        data: { status: 'failed', lockedAt: null, lastError: 'PROVIDER_RECONCILIATION_ATTEMPTS_EXHAUSTED' },
    });
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId, type: exports.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE,
            status: 'pending', processedAt: null, nextAttemptAt: { lte: now },
            attempts: { lt: exports.PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS },
        },
        data: { status: 'processing', lockedAt: now, attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'processing' || event.lockedAt?.getTime() !== now.getTime())
        return false;
    const owned = { id: eventId, status: 'processing', processedAt: null, lockedAt: now, attempts: event.attempts };
    try {
        const payload = event.payload;
        if (!payload.orderId || !payload.attemptId || !payload.paymentId || payload.orderId !== event.aggregateId) {
            throw new Error('PROVIDER_RECONCILIATION_INVALID_IDENTITY');
        }
        const attempt = await prisma_1.prisma.paymentAttempt.findUnique({ where: { id: payload.attemptId }, include: { order: true } });
        if (!attempt || attempt.orderId !== payload.orderId || attempt.providerPaymentId !== payload.paymentId) {
            throw new Error('PROVIDER_RECONCILIATION_IDENTITY_CONFLICT');
        }
        // Success/refund/cancellation writers remain authoritative once they finish.
        if (!recoverableStatuses.includes(attempt.status)
            || (attempt.status === 'succeeded' && attempt.order.status !== 'pending')) {
            await prisma_1.prisma.outboxEvent.updateMany({ where: owned, data: { status: 'completed', processedAt: new Date(), lockedAt: null } });
            return true;
        }
        if (attempt.provider !== (0, payment_service_1.getPaymentProvider)())
            throw new Error('PROVIDER_RECONCILIATION_PROVIDER_CONFLICT');
        const payment = await (0, payment_service_1.getPaymentStatus)(payload.paymentId);
        if (!(0, paymentValidation_service_1.matchesAuthoritativePayment)({ ...attempt.order, paymentAttempts: [attempt] }, payment, payload.paymentId)) {
            throw new Error('PROVIDER_RECONCILIATION_VALIDATION_FAILED');
        }
        const stillEligible = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            const ownership = await tx.outboxEvent.updateMany({ where: owned, data: { lockedAt: now } });
            if (ownership.count !== 1)
                return false;
            const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id }, include: { order: true } });
            if (!current || current.providerPaymentId !== payload.paymentId || current.orderId !== payload.orderId) {
                throw new Error('PROVIDER_RECONCILIATION_IDENTITY_CONFLICT');
            }
            if (!recoverableStatuses.includes(current.status)
                || (current.status === 'succeeded' && current.order.status !== 'pending'))
                return false;
            if (!(0, paymentValidation_service_1.matchesAuthoritativePayment)({ ...current.order, paymentAttempts: [current] }, payment, payload.paymentId)) {
                throw new Error('PROVIDER_RECONCILIATION_VALIDATION_FAILED');
            }
            if (current.order.paymentId && current.order.paymentId !== payload.paymentId) {
                throw new Error('PROVIDER_RECONCILIATION_ORDER_IDENTITY_CONFLICT');
            }
            if (!current.order.paymentId) {
                const linked = await tx.order.updateMany({
                    where: { id: payload.orderId, paymentId: null }, data: { paymentId: payload.paymentId },
                });
                if (linked.count !== 1)
                    throw new Error('PROVIDER_RECONCILIATION_BINDING_CONFLICT');
            }
            await tx.paymentAttempt.updateMany({
                where: { id: attempt.id, providerPaymentId: payload.paymentId, status: current.status },
                data: { lastCheckedAt: new Date() },
            });
            return true;
        }, { maxWait: 5000, timeout: 10000 });
        if (stillEligible) {
            if (!['succeeded', 'canceled'].includes(payment.status))
                throw new Error('PROVIDER_PAYMENT_NOT_TERMINAL');
            if (payment.status === 'succeeded' && !attempt.reservationId) {
                throw new Error('PROVIDER_RECONCILIATION_RESERVATION_MISSING');
            }
            // Use exactly the webhook's idempotent success/cancel path. No create,
            // reservation acquisition, or second payment can occur here.
            await (0, payment_service_1.handlePaymentWebhook)({ event: `payment.${payment.status}`, object: payment });
        }
        await prisma_1.prisma.outboxEvent.updateMany({ where: owned, data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null } });
        return true;
    }
    catch (error) {
        // Never persist provider URLs, request configuration, credentials, or raw
        // response descriptions in the operator-visible outbox diagnostics.
        const raw = error instanceof Error ? error.message : '';
        const knownCode = /^PROVIDER_(?:RECONCILIATION_[A-Z_]+|PAYMENT_NOT_TERMINAL)$/.test(raw);
        const authFailure = [401, 403].includes(error?.response?.status);
        const message = knownCode ? raw : authFailure ? 'PROVIDER_RECONCILIATION_AUTH_FAILED'
            : 'PROVIDER_RECONCILIATION_LOOKUP_OR_HANDLER_FAILED';
        const permanent = authFailure || (knownCode && raw !== 'PROVIDER_PAYMENT_NOT_TERMINAL');
        await prisma_1.prisma.outboxEvent.updateMany({
            where: owned,
            data: {
                status: permanent || event.attempts >= exports.PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS ? 'failed' : 'pending',
                lockedAt: null, nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
                lastError: message.slice(0, 1000),
            },
        });
        return false;
    }
};
exports.dispatchPaymentProviderReconciliationEvent = dispatchPaymentProviderReconciliationEvent;
//# sourceMappingURL=paymentProviderReconciliation.service.js.map