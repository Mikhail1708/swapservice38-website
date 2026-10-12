"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopCrmOutboxDispatcher = exports.startCrmOutboxDispatcher = exports.dispatchCrmOutboxOnce = exports.reconcileCrmOutbox = exports.replayFailedPaymentRefund = exports.dispatchPaymentRefundEvent = exports.dispatchReservationReleaseEvent = exports.dispatchCrmCancellationEvent = exports.dispatchPaymentReconciliationEvent = exports.dispatchCrmOutboxEvent = exports.acceleratePaymentReconciliationEvent = exports.ensurePaymentReconciliationEvent = exports.paymentReconciliationDeduplicationKey = exports.ensureReservationReleaseOutboxEvent = exports.ensureCrmCancellationOutboxEvent = exports.reservationReleaseDeduplicationKey = exports.crmCancellationDeduplicationKey = exports.paymentRefundDeduplicationKey = exports.ensurePaymentRefundOutboxEvent = exports.ensureCrmCreateOutboxEvent = exports.crmCreateDeduplicationKey = exports.CRM_CANCELLATION_MAX_ATTEMPTS = void 0;
const bankInvoiceDelivery_service_1 = require("./bankInvoiceDelivery.service");
const axios_1 = __importDefault(require("axios"));
const paymentProviderReconciliation_service_1 = require("./paymentProviderReconciliation.service");
const crmDelivery_service_1 = require("./crmDelivery.service");
const logger_1 = require("../config/logger");
const crm_queue_1 = require("../queues/crm.queue");
const crmOrderPayload_service_1 = require("./crmOrderPayload.service");
const paymentWorkflowLock_service_1 = require("./paymentWorkflowLock.service");
const internalApiKey_1 = require("../utils/internalApiKey");
const prisma_1 = require("../config/prisma");
const yooKassaRefund_service_1 = require("./yooKassaRefund.service");
const EVENT_TYPE = 'crm_order_create_requested';
const REFUND_EVENT_TYPE = 'payment_refund_requested';
const RECONCILIATION_EVENT_TYPE = 'payment_reconciliation_required';
const CANCELLATION_EVENT_TYPE = 'crm_order_cancellation_requested';
exports.CRM_CANCELLATION_MAX_ATTEMPTS = 8;
const RESERVATION_RELEASE_EVENT_TYPE = 'crm_reservation_release_requested';
const PROCESSING_LEASE_MS = 60000;
const DEFAULT_POLL_MS = 5000;
const crmCreateDeduplicationKey = (orderId) => `crm-order-create:${orderId}`;
exports.crmCreateDeduplicationKey = crmCreateDeduplicationKey;
const ensureCrmCreateOutboxEvent = async (db, orderId, orderData) => db.outboxEvent.upsert({
    where: { deduplicationKey: (0, exports.crmCreateDeduplicationKey)(orderId) },
    create: {
        aggregateId: orderId,
        type: EVENT_TYPE,
        deduplicationKey: (0, exports.crmCreateDeduplicationKey)(orderId),
        payload: { orderId, orderData },
    },
    update: {},
});
exports.ensureCrmCreateOutboxEvent = ensureCrmCreateOutboxEvent;
const ensurePaymentRefundOutboxEvent = async (db, orderId, paymentId, amountMinor, currency, reason = 'pre_handoff_compensation') => db.outboxEvent.upsert({
    where: { deduplicationKey: (0, exports.paymentRefundDeduplicationKey)(paymentId) },
    create: {
        aggregateId: orderId,
        type: REFUND_EVENT_TYPE,
        deduplicationKey: (0, exports.paymentRefundDeduplicationKey)(paymentId),
        payload: { orderId, paymentId, amountMinor, currency, reason, refundWorkflowVersion: 2 },
    },
    // The first deterministic refund intent is immutable. Eligibility checks in
    // the worker reject any later state that is incompatible with that reason.
    update: {},
});
exports.ensurePaymentRefundOutboxEvent = ensurePaymentRefundOutboxEvent;
const paymentRefundDeduplicationKey = (paymentId) => `payment-refund:${paymentId}`;
exports.paymentRefundDeduplicationKey = paymentRefundDeduplicationKey;
const crmCancellationDeduplicationKey = (orderId) => `crm-order-cancellation:${orderId}`;
exports.crmCancellationDeduplicationKey = crmCancellationDeduplicationKey;
const reservationReleaseDeduplicationKey = (reservationId) => `crm-reservation-release:${reservationId}`;
exports.reservationReleaseDeduplicationKey = reservationReleaseDeduplicationKey;
const ensureCrmCancellationOutboxEvent = async (db, orderId, crmOrderId, reason) => db.outboxEvent.upsert({
    where: { deduplicationKey: (0, exports.crmCancellationDeduplicationKey)(orderId) },
    create: {
        aggregateId: orderId,
        type: CANCELLATION_EVENT_TYPE,
        deduplicationKey: (0, exports.crmCancellationDeduplicationKey)(orderId),
        payload: {
            orderId,
            crmOrderId,
            requestId: (0, exports.crmCancellationDeduplicationKey)(orderId),
            reason,
        },
    },
    update: {},
});
exports.ensureCrmCancellationOutboxEvent = ensureCrmCancellationOutboxEvent;
const ensureReservationReleaseOutboxEvent = async (db, orderId, reservationId) => db.outboxEvent.upsert({
    where: { deduplicationKey: (0, exports.reservationReleaseDeduplicationKey)(reservationId) },
    create: {
        aggregateId: orderId,
        type: RESERVATION_RELEASE_EVENT_TYPE,
        deduplicationKey: (0, exports.reservationReleaseDeduplicationKey)(reservationId),
        payload: { orderId, reservationId },
    },
    update: {},
});
exports.ensureReservationReleaseOutboxEvent = ensureReservationReleaseOutboxEvent;
const paymentReconciliationDeduplicationKey = (paymentId) => `payment-reconciliation:${paymentId}`;
exports.paymentReconciliationDeduplicationKey = paymentReconciliationDeduplicationKey;
const ensurePaymentReconciliationEvent = async (db, orderId, paymentId, orderData) => {
    const deduplicationKey = (0, exports.paymentReconciliationDeduplicationKey)(paymentId);
    return db.outboxEvent.upsert({
        where: { deduplicationKey },
        create: {
            aggregateId: orderId,
            type: RECONCILIATION_EVENT_TYPE,
            deduplicationKey,
            payload: { orderId, paymentId, orderData },
        },
        update: {},
    });
};
exports.ensurePaymentReconciliationEvent = ensurePaymentReconciliationEvent;
const acceleratePaymentReconciliationEvent = async (db, eventId) => db.outboxEvent.updateMany({
    where: { id: eventId, status: 'pending', processedAt: null },
    data: { nextAttemptAt: new Date() },
});
exports.acceleratePaymentReconciliationEvent = acceleratePaymentReconciliationEvent;
const retryDelayMs = (attempts) => Math.min(60000, 1000 * (2 ** Math.min(attempts, 6)));
const dispatchCrmOutboxEvent = async (eventId) => {
    const dispatchLockedAt = new Date();
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId,
            type: EVENT_TYPE,
            status: 'pending',
            nextAttemptAt: { lte: new Date() },
            processedAt: null,
        },
        data: {
            status: 'dispatched',
            lockedAt: dispatchLockedAt,
            lastError: null,
        },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event)
        return false;
    try {
        let payload = event.payload;
        if (payload.orderId && !payload.orderData) {
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: payload.orderId },
                include: {
                    user: { select: { firstName: true, lastName: true, middleName: true, phone: true, email: true } },
                    paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
            });
            if (!order)
                throw new Error('CRM outbox order no longer exists');
            const attempt = order.paymentAttempts[0];
            const basePayload = (0, crmOrderPayload_service_1.buildCrmOrderPayload)(order);
            const orderData = attempt?.reservationId && attempt.providerPaymentId
                ? {
                    ...basePayload,
                    reservationId: attempt.reservationId,
                    paymentId: attempt.providerPaymentId,
                    paidAmountMinor: attempt.amountMinor,
                    currency: attempt.currency,
                    contractVersion: 1,
                }
                : basePayload;
            payload = { orderId: order.id, orderData };
            await prisma_1.prisma.outboxEvent.update({
                where: { id: event.id },
                data: { payload: payload },
            });
        }
        if (!payload.orderId || !payload.orderData)
            throw new Error('Invalid CRM outbox payload');
        await (0, crm_queue_1.addOrderToCRMQueue)(payload.orderId, payload.orderData);
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'dispatched', processedAt: null, lockedAt: dispatchLockedAt, attempts: event.attempts },
            data: { status: 'dispatched', lockedAt: null, lastError: null },
        });
        return true;
    }
    catch (error) {
        const nextAttemptAt = new Date(Date.now() + (0, crmDelivery_service_1.crmDeliveryDelayMs)(Math.max(1, event.attempts)));
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'dispatched', processedAt: null, lockedAt: dispatchLockedAt, attempts: event.attempts },
            data: {
                status: 'pending',
                lockedAt: null,
                nextAttemptAt,
                lastError: 'CRM queue or reconciliation dispatch failed',
            },
        });
        logger_1.log.error('CRM outbox dispatch failed', { eventId, orderId: event.aggregateId, error: error?.message });
        return false;
    }
};
exports.dispatchCrmOutboxEvent = dispatchCrmOutboxEvent;
const dispatchPaymentReconciliationEvent = async (eventId) => {
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId,
            type: RECONCILIATION_EVENT_TYPE,
            status: 'pending',
            nextAttemptAt: { lte: new Date() },
            processedAt: null,
        },
        data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event)
        return false;
    try {
        const payload = event.payload;
        if (!payload.orderId || !payload.paymentId || payload.orderId !== event.aggregateId
            || (payload.orderData?.paymentId && payload.orderData.paymentId !== payload.paymentId))
            throw new Error('Invalid payment reconciliation payload');
        const alreadyFulfilled = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            const [order, attempt] = await Promise.all([
                tx.order.findUnique({ where: { id: payload.orderId } }),
                tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } }),
            ]);
            if (!order)
                throw new Error('Payment reconciliation order no longer exists');
            if (!order.crmOrderId)
                return false;
            if (attempt?.providerPaymentId !== payload.paymentId || attempt.status !== 'succeeded') {
                throw new Error('PAYMENT_RECONCILIATION_CONFLICT: CRM order exists in incompatible payment state');
            }
            await tx.outboxEvent.updateMany({
                where: {
                    aggregateId: payload.orderId,
                    type: { in: [EVENT_TYPE, RECONCILIATION_EVENT_TYPE] },
                },
                data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
            });
            return true;
        });
        if (alreadyFulfilled)
            return true;
        const refundEvent = await prisma_1.prisma.outboxEvent.findUnique({
            where: { deduplicationKey: (0, exports.paymentRefundDeduplicationKey)(payload.paymentId) },
        });
        if (refundEvent) {
            await prisma_1.prisma.outboxEvent.updateMany({
                where: { id: event.id, status: 'processing', processedAt: null },
                data: {
                    status: 'completed', processedAt: new Date(), lockedAt: null,
                    lastError: 'Durable refund workflow already exists',
                },
            });
            return true;
        }
        let immutableOrderData = payload.orderData;
        if (!immutableOrderData) {
            const original = await prisma_1.prisma.outboxEvent.findUnique({
                where: { deduplicationKey: (0, exports.crmCreateDeduplicationKey)(payload.orderId) },
            });
            immutableOrderData = original?.payload?.orderData;
        }
        if (!immutableOrderData
            || immutableOrderData.contractVersion !== 1
            || typeof immutableOrderData.reservationId !== 'string'
            || typeof immutableOrderData.paymentId !== 'string') {
            throw new Error('Immutable CRM reservation payload is unavailable');
        }
        const canonical = await prisma_1.prisma.outboxEvent.findUnique({ where: { deduplicationKey: (0, exports.crmCreateDeduplicationKey)(payload.orderId) } });
        if (!canonical)
            throw new Error('Canonical CRM create intent is missing');
        if (canonical.status === 'failed' || canonical.attempts >= crmDelivery_service_1.CRM_DELIVERY_MAX_ATTEMPTS) {
            await prisma_1.prisma.outboxEvent.updateMany({ where: { id: event.id, status: 'processing', processedAt: null },
                data: { status: 'failed', lockedAt: null, lastError: 'Canonical CRM delivery failed or exhausted' } });
            return false;
        }
        // Upgrade pre-existing completed create markers from the former reconciliation flow.
        if (canonical.status === 'completed') {
            await prisma_1.prisma.outboxEvent.updateMany({ where: { id: canonical.id, status: 'completed', attempts: canonical.attempts },
                data: { status: 'pending', processedAt: null, lockedAt: null } });
        }
        await (0, exports.dispatchCrmOutboxEvent)(canonical.id);
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'processing', processedAt: null },
            data: { status: 'dispatched', lockedAt: null, lastError: null },
        });
        return true;
    }
    catch (error) {
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'processing', processedAt: null },
            data: {
                status: 'pending', lockedAt: null,
                nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
                lastError: 'CRM queue or reconciliation dispatch failed',
            },
        });
        logger_1.log.error('Payment reconciliation dispatch failed', {
            eventId, orderId: event.aggregateId, error: error?.message,
        });
        return false;
    }
};
exports.dispatchPaymentReconciliationEvent = dispatchPaymentReconciliationEvent;
const dispatchCrmCancellationEvent = async (eventId) => {
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId, type: CANCELLATION_EVENT_TYPE, status: 'pending',
            nextAttemptAt: { lte: new Date() }, processedAt: null,
        },
        data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event)
        return false;
    try {
        if (event.attempts > exports.CRM_CANCELLATION_MAX_ATTEMPTS) {
            throw new Error('CRM cancellation attempt budget exhausted');
        }
        const payload = event.payload;
        if (!payload.orderId || payload.orderId !== event.aggregateId || !payload.crmOrderId
            || payload.requestId !== (0, exports.crmCancellationDeduplicationKey)(payload.orderId))
            throw new Error('Invalid CRM cancellation payload');
        const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
        const response = await axios_1.default.post(`${crmApiUrl}/api/sale-documents/internal/v1/orders/${encodeURIComponent(payload.crmOrderId)}/cancellation`, {
            requestId: payload.requestId,
            externalOrderId: payload.orderId,
            reason: payload.reason || 'customer_request',
        }, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json', 'X-API-Key': (0, internalApiKey_1.getInternalApiKey)() },
        });
        const decision = response.data?.decision;
        if (decision !== 'accepted' && decision !== 'rejected' && decision !== 'requested') {
            throw new Error('CRM cancellation response has no authoritative decision');
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            const order = await tx.order.findUnique({ where: { id: payload.orderId } });
            if (!order)
                throw new Error('Cancellation order no longer exists');
            if (order.crmOrderId !== payload.crmOrderId) {
                throw new Error('CRM cancellation order identity changed');
            }
            if (order.cancellationState === 'requested' && decision !== 'requested') {
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        cancellationState: decision,
                        cancellationResolvedAt: new Date(),
                        cancellationDecisionReason: String(response.data?.reasonCode || decision).slice(0, 500),
                    },
                });
            }
            else if (decision !== 'requested' && order.cancellationState !== decision) {
                throw new Error(`Cancellation state changed to ${order.cancellationState}`);
            }
            await tx.outboxEvent.updateMany({
                where: { id: event.id, status: 'processing', processedAt: null },
                data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
            });
        });
        return true;
    }
    catch (error) {
        // Preserve the request for manual recovery, without polling a permanent
        // validation failure forever. Network/5xx failures retain bounded backoff.
        const permanent = [400, 404, 409, 422].includes(error?.response?.status);
        const exhausted = event.attempts >= exports.CRM_CANCELLATION_MAX_ATTEMPTS;
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'processing', processedAt: null },
            data: {
                status: permanent || exhausted ? 'failed' : 'pending', lockedAt: null,
                nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
                lastError: String(error?.message || error).slice(0, 1000),
            },
        });
        logger_1.log.error('CRM cancellation dispatch failed', {
            eventId, orderId: event.aggregateId, error: error?.message,
        });
        return false;
    }
};
exports.dispatchCrmCancellationEvent = dispatchCrmCancellationEvent;
const dispatchReservationReleaseEvent = async (eventId) => {
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId, type: RESERVATION_RELEASE_EVENT_TYPE, status: 'pending',
            nextAttemptAt: { lte: new Date() }, processedAt: null,
        },
        data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event)
        return false;
    try {
        const payload = event.payload;
        if (!payload.orderId || payload.orderId !== event.aggregateId || !payload.reservationId) {
            throw new Error('Invalid reservation release payload');
        }
        const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
        await axios_1.default.post(`${crmApiUrl}/api/sale-documents/internal/v1/reservations/${encodeURIComponent(payload.reservationId)}/release`, {}, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json', 'X-API-Key': (0, internalApiKey_1.getInternalApiKey)() },
        });
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            await tx.outboxEvent.updateMany({
                where: { id: event.id, status: 'processing', processedAt: null },
                data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
            });
        });
        return true;
    }
    catch (error) {
        await prisma_1.prisma.outboxEvent.updateMany({
            where: { id: event.id, status: 'processing', processedAt: null },
            data: {
                status: 'pending', lockedAt: null,
                nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
                lastError: String(error?.message || error).slice(0, 1000),
            },
        });
        logger_1.log.error('CRM reservation release dispatch failed', {
            eventId, orderId: event.aggregateId, error: error?.message,
        });
        return false;
    }
};
exports.dispatchReservationReleaseEvent = dispatchReservationReleaseEvent;
const dispatchPaymentRefundEvent = async (eventId) => {
    const lockedAt = new Date();
    const claimed = await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            id: eventId, type: REFUND_EVENT_TYPE, status: 'pending',
            nextAttemptAt: { lte: new Date() }, processedAt: null,
        },
        data: { status: 'processing', lockedAt, attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1)
        return false;
    const event = await prisma_1.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'processing' || event.lockedAt?.getTime() !== lockedAt.getTime())
        return false;
    const owned = { id: event.id, status: 'processing', processedAt: null, lockedAt, attempts: event.attempts };
    const payload = event.payload;
    const reason = payload.reason || 'pre_handoff_compensation';
    try {
        if (!payload.orderId || !payload.paymentId || !Number.isSafeInteger(payload.amountMinor)
            || payload.amountMinor <= 0 || payload.currency !== 'RUB' || payload.orderId !== event.aggregateId
            || !['pre_handoff_compensation', 'pre_handoff_customer_cancellation', 'post_handoff_cancellation'].includes(reason))
            throw new Error('Invalid refund outbox payload');
        const preflight = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            if ((await tx.outboxEvent.updateMany({ where: owned, data: { lockedAt } })).count !== 1)
                throw new yooKassaRefund_service_1.RefundProviderError('REFUND_LEASE_LOST');
            const [order, attempt] = await Promise.all([
                tx.order.findUnique({ where: { id: payload.orderId } }),
                tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } }),
            ]);
            if (!order || !attempt || attempt.providerPaymentId !== payload.paymentId
                || attempt.amountMinor !== payload.amountMinor || attempt.currency !== payload.currency) {
                throw new Error('REFUND_RECONCILIATION_REQUIRED: refund identity mismatch');
            }
            if (attempt.status === 'refunded')
                return { alreadyRefunded: true, refundId: attempt.refundId };
            const postHandoff = reason === 'post_handoff_cancellation';
            const eligible = postHandoff
                ? Boolean(order.crmOrderId && order.status === 'cancelled' && attempt.status === 'refund_required')
                : Boolean(!order.crmOrderId && attempt.status === 'compensation_required'
                    && (reason !== 'pre_handoff_customer_cancellation'
                        || (order.status === 'cancelled' && order.cancellationState === 'accepted')));
            if (!eligible) {
                throw new Error('REFUND_RECONCILIATION_REQUIRED: payment is not eligible for this refund reason');
            }
            await tx.paymentAttempt.update({
                where: { id: attempt.id },
                data: {
                    refundReason: reason,
                    refundRequestedAt: attempt.refundRequestedAt || new Date(),
                    lastCheckedAt: new Date(),
                },
            });
            return { alreadyRefunded: false, refundId: attempt.refundId,
                legacyStartedAt: payload.refundWorkflowVersion !== 2 && event.attempts > 1 ? event.createdAt || attempt.refundRequestedAt : null };
        });
        let refundId = preflight.refundId || null;
        if (!payload.refundPostStartedAt && preflight.legacyStartedAt)
            payload.refundPostStartedAt = preflight.legacyStartedAt.toISOString();
        if (!preflight.alreadyRefunded) {
            if (process.env.PAYMENT_PROVIDER === 'mock' && process.env.NODE_ENV !== 'production') {
                refundId = `mock-refund-${payload.paymentId}`;
            }
            else {
                let admittedFreshPost = false;
                const result = await (0, yooKassaRefund_service_1.reconcileYooKassaRefund)({ paymentId: payload.paymentId, amountMinor: payload.amountMinor,
                    currency: payload.currency, orderId: payload.orderId, reason, idempotencyKey: event.deduplicationKey, refundId,
                    beforePost: async () => {
                        // Persist admission before the socket write. The provider only guarantees
                        // this key for 24h; ambiguous older submissions require operator review.
                        const started = payload.refundPostStartedAt || preflight.legacyStartedAt?.toISOString();
                        if (started && (!Number.isFinite(Date.parse(started)) || Date.now() - Date.parse(started) >= 23 * 60 * 60000)) {
                            throw new yooKassaRefund_service_1.RefundProviderError('REFUND_IDEMPOTENCY_WINDOW_EXPIRED');
                        }
                        const nextPayload = { ...payload, refundWorkflowVersion: 2, refundPostStartedAt: started || new Date().toISOString() };
                        const updated = await prisma_1.prisma.outboxEvent.updateMany({ where: owned, data: { payload: nextPayload } });
                        if (updated.count !== 1)
                            throw new yooKassaRefund_service_1.RefundProviderError('REFUND_LEASE_LOST');
                        admittedFreshPost = !started;
                        Object.assign(payload, nextPayload);
                    },
                    onNotRefundableRejection: async () => {
                        // A definitive rejection of the FIRST submission cannot have created a
                        // refund. Never clear the clock of an earlier ambiguous submission.
                        if (!admittedFreshPost)
                            return;
                        const nextPayload = { ...payload };
                        delete nextPayload.refundPostStartedAt;
                        if ((await prisma_1.prisma.outboxEvent.updateMany({ where: owned,
                            data: { payload: nextPayload } })).count !== 1)
                            throw new yooKassaRefund_service_1.RefundProviderError('REFUND_LEASE_LOST');
                        delete payload.refundPostStartedAt;
                    },
                    saveRefundId: async (id) => {
                        await prisma_1.prisma.$transaction(async (tx) => {
                            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
                            if ((await tx.outboxEvent.updateMany({ where: owned, data: { lockedAt } })).count !== 1)
                                throw new yooKassaRefund_service_1.RefundProviderError('REFUND_LEASE_LOST');
                            const saved = await tx.paymentAttempt.updateMany({ where: { orderId: payload.orderId, providerPaymentId: payload.paymentId,
                                    status: { in: ['compensation_required', 'refund_required'] } }, data: { refundId: id } });
                            if (saved.count !== 1)
                                throw new yooKassaRefund_service_1.RefundProviderError('REFUND_ATTEMPT_STATE_CHANGED');
                        });
                    },
                });
                refundId = result.refundId;
            }
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
            if ((await tx.outboxEvent.updateMany({ where: owned, data: { lockedAt } })).count !== 1)
                throw new yooKassaRefund_service_1.RefundProviderError('REFUND_LEASE_LOST');
            const attempt = await tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } });
            if (!attempt || attempt.providerPaymentId !== payload.paymentId) {
                throw new Error('REFUND_RECONCILIATION_REQUIRED: state changed during refund');
            }
            if (attempt.status !== 'refunded') {
                const expectedStatus = reason === 'post_handoff_cancellation' ? 'refund_required' : 'compensation_required';
                const updated = await tx.paymentAttempt.updateMany({
                    where: { id: attempt.id, status: expectedStatus },
                    data: {
                        status: 'refunded', refundReason: reason, refundId,
                        refundedAt: new Date(), lastCheckedAt: new Date(), lastError: null,
                    },
                });
                if (updated.count !== 1) {
                    throw new Error('REFUND_RECONCILIATION_REQUIRED: state changed during refund');
                }
            }
            await tx.outboxEvent.updateMany({
                where: owned,
                data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
            });
        });
        return true;
    }
    catch (error) {
        const failure = (0, yooKassaRefund_service_1.refundFailure)(error);
        const lastError = JSON.stringify(failure.diagnostic);
        const waiting = error instanceof yooKassaRefund_service_1.RefundProviderError && error.temporary;
        const configuredMax = Number.parseInt(process.env.REFUND_MAX_ATTEMPTS || '8', 10);
        const maxAttempts = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 8;
        if (payload.orderId && !waiting && (failure.terminal || event.attempts >= maxAttempts)) {
            await prisma_1.prisma.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
                if ((await tx.outboxEvent.updateMany({ where: owned, data: { lockedAt } })).count !== 1)
                    return;
                await tx.paymentAttempt.updateMany({
                    where: {
                        orderId: payload.orderId,
                        providerPaymentId: payload.paymentId,
                        status: { in: ['compensation_required', 'refund_required'] },
                    },
                    data: { status: 'refund_failed', refundReason: reason, lastCheckedAt: new Date(), lastError },
                });
                await tx.outboxEvent.updateMany({
                    where: owned,
                    data: { status: 'failed', lockedAt: null, lastError },
                });
            });
        }
        else {
            await prisma_1.prisma.$transaction(async (tx) => {
                if (payload.orderId)
                    await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, payload.orderId);
                const updated = await tx.outboxEvent.updateMany({ where: owned, data: {
                        status: 'pending', lockedAt: null, lastError,
                        nextAttemptAt: new Date(Date.now() + (waiting
                            ? Math.min(6 * 60 * 60000, 5 * 60000 * 2 ** Math.min(Math.max(0, Math.floor((Date.now() - (event.createdAt?.getTime() || Date.now())) / 3600000)), 7))
                            : Math.min(30 * 60000, 30000 * 2 ** Math.min(event.attempts - 1, 6)))),
                        ...(waiting ? { attempts: Math.max(0, event.attempts - 1), payload: { ...payload, refundWorkflowVersion: 2,
                                ...(payload.refundPostStartedAt ? { refundPostStartedAt: payload.refundPostStartedAt } : {}) } } : {}),
                    } });
                if (updated.count && payload.orderId)
                    await tx.paymentAttempt.updateMany({
                        where: { orderId: payload.orderId, providerPaymentId: payload.paymentId, status: { in: ['refund_required', 'compensation_required'] } },
                        data: { lastCheckedAt: new Date(), lastError },
                    });
            });
        }
        (waiting ? logger_1.log.info : logger_1.log.error)('Payment refund dispatch deferred or failed', { eventId, orderId: event.aggregateId, ...failure.diagnostic });
        return false;
    }
};
exports.dispatchPaymentRefundEvent = dispatchPaymentRefundEvent;
const replayFailedPaymentRefund = async (orderId) => prisma_1.prisma.$transaction(async (tx) => {
    await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
    const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    if (!attempt?.providerPaymentId || attempt.status !== 'refund_failed' || !attempt.refundReason) {
        throw new Error('Payment refund is not in a replayable failed state');
    }
    const event = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: (0, exports.paymentRefundDeduplicationKey)(attempt.providerPaymentId) },
    });
    if (!event || event.type !== REFUND_EVENT_TYPE || event.status !== 'failed' || event.processedAt) {
        throw new Error('Failed deterministic refund intent was not found');
    }
    const requiredStatus = attempt.refundReason === 'post_handoff_cancellation'
        ? 'refund_required'
        : 'compensation_required';
    const paymentAttempt = await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: requiredStatus, lastError: null, lastCheckedAt: new Date() },
    });
    const outboxEvent = await tx.outboxEvent.update({
        where: { id: event.id },
        data: {
            status: 'pending', attempts: 0, nextAttemptAt: new Date(), lockedAt: null,
            processedAt: null, lastError: null,
            ...(event.payload?.refundWorkflowVersion !== 2 && event.attempts > 0 ? {
                payload: { ...event.payload, refundWorkflowVersion: 2,
                    refundPostStartedAt: (event.createdAt || attempt.refundRequestedAt).toISOString() },
            } : {}),
        },
    });
    return { paymentAttempt, outboxEvent };
});
exports.replayFailedPaymentRefund = replayFailedPaymentRefund;
let strandedOrderCursor = null;
const reconcileCrmOutbox = async () => {
    const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
    await prisma_1.prisma.outboxEvent.updateMany({
        where: {
            type: {
                in: [
                    EVENT_TYPE, REFUND_EVENT_TYPE, RECONCILIATION_EVENT_TYPE,
                    CANCELLATION_EVENT_TYPE, RESERVATION_RELEASE_EVENT_TYPE, paymentProviderReconciliation_service_1.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE,
                    bankInvoiceDelivery_service_1.BANK_INVOICE_INTAKE_TYPE, bankInvoiceDelivery_service_1.BANK_INVOICE_RELEASE_TYPE,
                ],
            },
            OR: [
                { status: 'processing', updatedAt: { lt: staleBefore } },
                { status: 'dispatched', updatedAt: { lt: new Date(Date.now() - 5 * PROCESSING_LEASE_MS) } },
            ],
            processedAt: null,
        },
        data: { status: 'pending', lockedAt: null, nextAttemptAt: new Date() },
    });
    const strandedOrders = await prisma_1.prisma.order.findMany({
        where: {
            status: { in: ['paid', 'crm_failed'] }, crmOrderId: null,
            cancellationState: { notIn: ['requested', 'accepted'] },
        },
        include: {
            user: { select: { firstName: true, lastName: true, middleName: true, phone: true, email: true } },
            paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { id: 'asc' },
        ...(strandedOrderCursor ? { cursor: { id: strandedOrderCursor }, skip: 1 } : {}),
        take: 100,
    });
    strandedOrderCursor = strandedOrders.length === 100
        ? strandedOrders[strandedOrders.length - 1].id
        : null;
    for (const order of strandedOrders) {
        const attempt = order.paymentAttempts[0];
        if (order.status === 'crm_failed'
            && attempt?.status === 'compensation_required'
            && attempt.providerPaymentId) {
            const original = await prisma_1.prisma.outboxEvent.findUnique({
                where: { deduplicationKey: (0, exports.crmCreateDeduplicationKey)(order.id) },
            });
            const immutableOrderData = original?.payload?.orderData;
            if (original?.status === 'failed')
                continue;
            if (immutableOrderData) {
                await (0, exports.ensurePaymentReconciliationEvent)(prisma_1.prisma, order.id, attempt.providerPaymentId, immutableOrderData);
            }
            else {
                logger_1.log.error('Cannot repair payment reconciliation without immutable CRM payload', { orderId: order.id });
            }
            continue;
        }
        const basePayload = (0, crmOrderPayload_service_1.buildCrmOrderPayload)(order);
        const orderData = attempt?.reservationId && attempt.providerPaymentId
            ? {
                ...basePayload,
                reservationId: attempt.reservationId,
                paymentId: attempt.providerPaymentId,
                paidAmountMinor: attempt.amountMinor,
                currency: attempt.currency,
                contractVersion: 1,
            }
            : basePayload;
        const deduplicationKey = (0, exports.crmCreateDeduplicationKey)(order.id);
        const existing = await prisma_1.prisma.outboxEvent.findUnique({ where: { deduplicationKey } });
        const existingPayload = existing?.payload;
        // The additive migration creates repair markers for legacy paid orders. Their
        // immutable CRM payload cannot be assembled safely in SQL, so hydrate only
        // those pending markers once from the current server-side order snapshot.
        if (existing && existing.status === 'pending' && !existingPayload?.orderData) {
            await prisma_1.prisma.outboxEvent.update({
                where: { id: existing.id },
                data: { payload: { orderId: order.id, orderData } },
            });
        }
        else {
            await (0, exports.ensureCrmCreateOutboxEvent)(prisma_1.prisma, order.id, orderData);
        }
    }
};
exports.reconcileCrmOutbox = reconcileCrmOutbox;
const runCrmOutboxCycle = async () => {
    await (0, exports.reconcileCrmOutbox)();
    await (0, paymentProviderReconciliation_service_1.scanPaymentProviderReconciliationAttempts)();
    await bankInvoiceDelivery_service_1.bankInvoiceDeliveryService.recover();
    const events = await prisma_1.prisma.outboxEvent.findMany({
        where: {
            type: {
                in: [
                    EVENT_TYPE, REFUND_EVENT_TYPE, RECONCILIATION_EVENT_TYPE,
                    CANCELLATION_EVENT_TYPE, RESERVATION_RELEASE_EVENT_TYPE, paymentProviderReconciliation_service_1.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE,
                    bankInvoiceDelivery_service_1.BANK_INVOICE_INTAKE_TYPE, bankInvoiceDelivery_service_1.BANK_INVOICE_RELEASE_TYPE,
                ],
            },
            status: 'pending', nextAttemptAt: { lte: new Date() }, processedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
        select: { id: true, type: true },
    });
    const results = await Promise.all(events.map(({ id, type }) => {
        if (type === bankInvoiceDelivery_service_1.BANK_INVOICE_INTAKE_TYPE || type === bankInvoiceDelivery_service_1.BANK_INVOICE_RELEASE_TYPE)
            return bankInvoiceDelivery_service_1.bankInvoiceDeliveryService.dispatch(id);
        if (type === paymentProviderReconciliation_service_1.PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE)
            return (0, paymentProviderReconciliation_service_1.dispatchPaymentProviderReconciliationEvent)(id);
        if (type === REFUND_EVENT_TYPE)
            return (0, exports.dispatchPaymentRefundEvent)(id);
        if (type === RECONCILIATION_EVENT_TYPE)
            return (0, exports.dispatchPaymentReconciliationEvent)(id);
        if (type === CANCELLATION_EVENT_TYPE)
            return (0, exports.dispatchCrmCancellationEvent)(id);
        if (type === RESERVATION_RELEASE_EVENT_TYPE)
            return (0, exports.dispatchReservationReleaseEvent)(id);
        return (0, exports.dispatchCrmOutboxEvent)(id);
    }));
    return results.filter(Boolean).length;
};
let activeDispatchCycle = null;
const dispatchCrmOutboxOnce = () => {
    if (activeDispatchCycle)
        return activeDispatchCycle;
    activeDispatchCycle = runCrmOutboxCycle().finally(() => { activeDispatchCycle = null; });
    return activeDispatchCycle;
};
exports.dispatchCrmOutboxOnce = dispatchCrmOutboxOnce;
let dispatcherTimer = null;
const startCrmOutboxDispatcher = () => {
    if (dispatcherTimer)
        return;
    const configured = Number.parseInt(process.env.CRM_OUTBOX_POLL_MS || '', 10);
    const pollMs = Number.isFinite(configured) && configured >= 1000 ? configured : DEFAULT_POLL_MS;
    void (0, exports.dispatchCrmOutboxOnce)().catch((error) => logger_1.log.error('CRM outbox startup dispatch failed', { error }));
    dispatcherTimer = setInterval(() => {
        void (0, exports.dispatchCrmOutboxOnce)().catch((error) => logger_1.log.error('CRM outbox dispatch cycle failed', { error }));
    }, pollMs);
    dispatcherTimer.unref?.();
};
exports.startCrmOutboxDispatcher = startCrmOutboxDispatcher;
const stopCrmOutboxDispatcher = () => {
    if (dispatcherTimer)
        clearInterval(dispatcherTimer);
    dispatcherTimer = null;
};
exports.stopCrmOutboxDispatcher = stopCrmOutboxDispatcher;
//# sourceMappingURL=crmOutbox.service.js.map