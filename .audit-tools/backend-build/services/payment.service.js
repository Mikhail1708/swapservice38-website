"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendOrderToCRM = exports.resetMockPaymentsForTests = exports.completeMockPayment = exports.getPaymentStatus = exports.handlePaymentWebhook = exports.handlePaymentSuccess = exports.createPayment = exports.getPaymentProvider = void 0;
// backend/src/services/payment.service.ts
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const paymentHttp_1 = require("../config/paymentHttp");
const redis_1 = require("../config/redis");
const email_service_1 = require("./email.service");
const logger_1 = require("../config/logger");
const orderStatus_1 = require("../utils/orderStatus");
const crmOrderPayload_service_1 = require("./crmOrderPayload.service");
const checkoutInventory_service_1 = require("./checkoutInventory.service");
const paymentAttempt_service_1 = require("./paymentAttempt.service");
const crmOutbox_service_1 = require("./crmOutbox.service");
const paymentWorkflowLock_service_1 = require("./paymentWorkflowLock.service");
const orderPaymentView_service_1 = require("./orderPaymentView.service");
const crmDelivery_service_1 = require("./crmDelivery.service");
const prisma_1 = require("../config/prisma");
// ✅ БЕРЁМ ИЗ .ENV
const YOO_KASSA_SHOP_ID = process.env.YOO_KASSA_SHOP_ID || '';
const YOO_KASSA_SECRET_KEY = process.env.YOO_KASSA_SECRET_KEY || '';
const YOO_KASSA_API_URL = 'https://api.yookassa.ru/v3';
const mockPayments = new Map();
const getPaymentProvider = () => {
    const provider = process.env.PAYMENT_PROVIDER;
    if (provider !== 'mock' && provider !== 'yookassa') {
        throw new Error('PAYMENT_PROVIDER must be explicitly set to "mock" or "yookassa"');
    }
    if (process.env.NODE_ENV === 'production' && provider === 'mock') {
        throw new Error('Mock payment provider is forbidden in production');
    }
    return provider;
};
exports.getPaymentProvider = getPaymentProvider;
const assertYooKassaCredentials = () => {
    if (!YOO_KASSA_SHOP_ID || !YOO_KASSA_SECRET_KEY) {
        throw new Error('YooKassa credentials are not configured');
    }
};
// ============================================================
// ОЧИСТКА ТЕЛЕФОНА
// ============================================================
const cleanPhone = (phone) => {
    if (!phone)
        return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 11) {
        cleaned = '7' + cleaned.substring(1);
    }
    if (cleaned.length === 11) {
        return '+' + cleaned;
    }
    if (cleaned.length === 10) {
        return '+7' + cleaned;
    }
    return phone;
};
const assertPaymentStartEligible = (order) => {
    if ((0, orderPaymentView_service_1.isOnlinePaymentBlocked)(order, order.invoice)) {
        throw new paymentAttempt_service_1.PaymentPreparationError('Для заказа выбран банковский счёт; онлайн-оплата недоступна', 409, 'BANK_INVOICE_PAYMENT_LOCKED');
    }
    if (order.status === 'cancelled' || ['requested', 'accepted'].includes(order.cancellationState || 'none')) {
        throw new paymentAttempt_service_1.PaymentPreparationError('Оплата недоступна во время отмены заказа', 409, 'ORDER_CANCELLATION_ACTIVE');
    }
};
const markProviderRequestStartedIfEligible = async (orderId, attemptId) => prisma_1.prisma.$transaction(async (tx) => {
    await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
    const currentOrder = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
    if (!currentOrder)
        throw new Error('Заказ не найден');
    assertPaymentStartEligible(currentOrder);
    return tx.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: 'initiating', providerRequestStartedAt: new Date(), lastError: null },
    });
}, { maxWait: 5000, timeout: 10000 });
// ============================================================
// СОЗДАНИЕ ПЛАТЕЖА
// ============================================================
// backend/src/services/payment.service.ts
const createPayment = async (orderId, returnUrl) => {
    let activeAttemptId = null;
    let providerRequestStarted = false;
    try {
        // ============================================================
        // 1. ПОЛУЧАЕМ ЗАКАЗ
        // ============================================================
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { invoice: true },
        });
        if (!order) {
            throw new Error('Заказ не найден');
        }
        if (order.status === 'paid') {
            throw new Error('Заказ уже оплачен');
        }
        assertPaymentStartEligible(order);
        if (order.paymentId) {
            const existingPayment = await (0, exports.getPaymentStatus)(order.paymentId);
            if (existingPayment?.status === 'pending' || existingPayment?.status === 'succeeded') {
                if (existingPayment.status === 'pending') {
                    const existingAttempt = await prisma_1.prisma.paymentAttempt.findUnique({ where: { orderId } });
                    if (existingAttempt?.reservationId)
                        await (0, paymentAttempt_service_1.ensureCrmReservation)(order, existingAttempt);
                }
                const mockReturnUrl = `${process.env.CLIENT_URL || 'http://localhost:3001'}`
                    + `/payment/success?orderId=${orderId}&paymentId=${order.paymentId}&mock=1`;
                return {
                    paymentId: order.paymentId,
                    paymentUrl: existingPayment?.confirmation?.confirmation_url
                        || ((0, exports.getPaymentProvider)() === 'mock' ? mockReturnUrl : returnUrl),
                    status: existingPayment.status,
                    idempotent: true,
                };
            }
        }
        const provider = (0, exports.getPaymentProvider)();
        // Serialize first-attempt validation with its durable creation. A sibling
        // request must see the attempt before its reservation consumes free stock.
        // Even an attempt without reservationId can own a CRM reservation after a
        // lost response: recover it by externalOrderId instead of checking free stock.
        let attempt = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
            const currentOrder = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
            if (!currentOrder)
                throw new Error('Заказ не найден');
            if (currentOrder.status === 'paid')
                throw new Error('Заказ уже оплачен');
            assertPaymentStartEligible(currentOrder);
            const existing = await tx.paymentAttempt.findUnique({ where: { orderId } });
            if (existing)
                return existing;
            await (0, checkoutInventory_service_1.assertCheckoutSnapshotStillCurrent)(currentOrder.items, currentOrder.total);
            return (0, paymentAttempt_service_1.getOrCreatePaymentAttempt)(currentOrder, provider, tx);
        }, { maxWait: 5000, timeout: 15000 });
        activeAttemptId = attempt.id;
        // Recover a provider response that was persisted on the attempt but not yet
        // returned to the browser after a process interruption.
        if (attempt.providerPaymentId) {
            const existingPayment = await (0, exports.getPaymentStatus)(attempt.providerPaymentId);
            if (existingPayment?.status === 'pending' || existingPayment?.status === 'succeeded') {
                if (existingPayment.status === 'pending')
                    await (0, paymentAttempt_service_1.ensureCrmReservation)(order, attempt);
                return {
                    paymentId: attempt.providerPaymentId,
                    paymentUrl: existingPayment?.confirmation?.confirmation_url || returnUrl,
                    status: existingPayment.status,
                    idempotent: true,
                };
            }
        }
        attempt = await (0, paymentAttempt_service_1.ensureCrmReservation)(order, attempt);
        if (provider === 'mock') {
            await markProviderRequestStartedIfEligible(orderId, attempt.id);
            providerRequestStarted = true;
            // Match the real provider's per-attempt idempotency under double clicks.
            const mockPaymentId = `mock_${attempt.id}`;
            const mockPayment = mockPayments.get(mockPaymentId) || {
                id: mockPaymentId,
                status: 'pending',
                amount: { value: (attempt.amountMinor / 100).toFixed(2), currency: 'RUB' },
                metadata: {
                    orderId: order.id,
                    reservationId: attempt.reservationId || '',
                    crmOrderId: order.crmOrderId || '',
                    orderNumber: order.orderNumber || '',
                },
            };
            await (0, paymentAttempt_service_1.bindProviderPaymentToOrder)(attempt.id, orderId, mockPayment.id, mockPayment.status);
            mockPayments.set(mockPayment.id, mockPayment);
            return {
                paymentId: mockPayment.id,
                paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:3001'}`
                    + `/payment/success?orderId=${orderId}&paymentId=${mockPayment.id}&mock=1`,
                status: mockPayment.status,
            };
        }
        // ============================================================
        // 3. БОЕВОЙ РЕЖИМ
        // ============================================================
        assertYooKassaCredentials();
        const auth = Buffer.from(`${YOO_KASSA_SHOP_ID}:${YOO_KASSA_SECRET_KEY}`).toString('base64');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Idempotence-Key': attempt.idempotencyKey,
        };
        const items = order.items.map((item) => ({
            description: item.name || 'Товар',
            quantity: item.quantity,
            amount: {
                value: item.price.toFixed(2),
                currency: 'RUB',
            },
            vat_code: 1,
            payment_subject: 'commodity',
            payment_mode: 'full_payment',
        }));
        if (order.deliveryMethod && order.deliveryMethod !== 'pickup') {
            items.push({
                description: 'Доставка',
                quantity: 1,
                amount: {
                    value: '0.00',
                    currency: 'RUB',
                },
                vat_code: 1,
                payment_subject: 'service',
                payment_mode: 'full_payment',
            });
        }
        const paymentData = {
            amount: {
                value: (attempt.amountMinor / 100).toFixed(2),
                currency: 'RUB',
            },
            capture: true,
            confirmation: {
                type: 'redirect',
                return_url: returnUrl,
            },
            description: `Заказ #${order.orderNumber || order.id.slice(0, 8)}`,
            metadata: {
                orderId: order.id,
                reservationId: attempt.reservationId || '',
                crmOrderId: order.crmOrderId || '',
                orderNumber: order.orderNumber || '',
            },
            receipt: {
                customer: {
                    email: order.customerEmail || order.guestEmail || undefined,
                    phone: order.customerPhone || order.guestPhone || undefined,
                },
                items: items,
            },
        };
        await markProviderRequestStartedIfEligible(orderId, attempt.id);
        providerRequestStarted = true;
        const response = await axios_1.default.post(`${YOO_KASSA_API_URL}/payments`, paymentData, { headers, timeout: (0, paymentHttp_1.paymentHttpTimeoutMs)() });
        await (0, paymentAttempt_service_1.bindProviderPaymentToOrder)(attempt.id, orderId, response.data.id, response.data.status);
        return {
            paymentId: response.data.id,
            paymentUrl: response.data.confirmation.confirmation_url,
            status: response.data.status,
        };
    }
    catch (error) {
        if (activeAttemptId && providerRequestStarted) {
            await (0, paymentAttempt_service_1.markProviderOutcomeUnknown)(activeAttemptId, error).catch(() => undefined);
        }
        if (error instanceof paymentAttempt_service_1.PaymentPreparationError)
            throw error;
        // ============================================================
        // 4. ОБРАБОТКА ОШИБОК
        // ============================================================
        // ✅ ЕСЛИ ЭТО НАША ОШИБКА — ПРОБРАСЫВАЕМ БЕЗ ИЗМЕНЕНИЙ
        if (error instanceof checkoutInventory_service_1.CheckoutInventoryError ||
            error.message === 'Заказ не найден' ||
            error.message === 'Заказ уже оплачен') {
            throw error;
        }
        // ✅ ОШИБКА ЮKASSA
        if (error.response?.data?.description) {
            logger_1.log.error('YooKassa payment request failed', {
                orderId,
                status: error.response.status,
            });
            throw new Error('Ошибка платёжного провайдера');
        }
        // ✅ ДРУГИЕ ОШИБКИ
        logger_1.log.error('❌ Ошибка создания платежа', {
            orderId,
            error: error.message || error
        });
        throw new Error('Ошибка создания платежа');
    }
};
exports.createPayment = createPayment;
// ============================================================
// ОБРАБОТКА УСПЕШНОЙ ОПЛАТЫ → ОТПРАВКА В CRM ЧЕРЕЗ ОЧЕРЕДЬ
// ============================================================
const handlePaymentSuccess = async (orderId) => {
    logger_1.log.info(`🔄 [handlePaymentSuccess] Начало обработки заказа ${orderId}`);
    const processedKey = `order:processed:${orderId}`;
    const lockKey = `order:processing:${orderId}`;
    // ✅ БЛОКИРУЕМ
    try {
        const processing = await redis_1.safeRedis.get(lockKey);
        if (processing) {
            logger_1.log.info(`ℹ️ Заказ ${orderId} уже обрабатывается, пропускаем`);
            // Never acknowledge payment solely from an ephemeral lock. The database
            // CAS and unique outbox key are the authoritative concurrency controls.
        }
        await redis_1.safeRedis.setex(lockKey, 30, 'true');
        logger_1.log.debug(`🔒 Заказ ${orderId} заблокирован для обработки`);
    }
    catch (error) {
        logger_1.log.warn('⚠️ Ошибка блокировки Redis', { error });
    }
    // ✅ ПРОВЕРЯЕМ, НЕ БЫЛ ЛИ УЖЕ ОБРАБОТАН
    try {
        const cached = await redis_1.safeRedis.get(processedKey);
        if (cached) {
            logger_1.log.info(`ℹ️ Заказ ${orderId} уже был обработан, пропускаем`);
            // Redis is only an optimization. Continue to verify/repair the durable
            // PostgreSQL outbox after a possible process crash.
        }
    }
    catch (error) {
        logger_1.log.warn('⚠️ Ошибка проверки Redis', { error });
    }
    // ✅ ПОЛУЧАЕМ ЗАКАЗ
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    middleName: true,
                    phone: true,
                    email: true,
                },
            },
            paymentAttempts: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    });
    if (!order) {
        logger_1.log.error(`❌ Заказ ${orderId} не найден`);
        await redis_1.safeRedis.del(lockKey);
        throw new Error(`Заказ ${orderId} не найден`);
    }
    logger_1.log.debug(`📦 Заказ ${orderId} найден`, {
        status: order.status,
        crmOrderId: order.crmOrderId,
        orderNumber: order.orderNumber,
        total: order.total,
    });
    let paymentAttempt = order.paymentAttempts?.[0];
    // Rolling deployment safety: if an older process stored paymentId without
    // creating the additive attempt row, reconstruct the durable link before any
    // fulfillment decision.
    if (!paymentAttempt && order.paymentId) {
        const reconstructed = await (0, paymentAttempt_service_1.getOrCreatePaymentAttempt)(order, order.paymentId.startsWith('mock_') ? 'mock' : 'yookassa');
        paymentAttempt = reconstructed.providerPaymentId
            ? reconstructed
            : await prisma_1.prisma.paymentAttempt.update({
                where: { id: reconstructed.id },
                data: { providerPaymentId: order.paymentId, status: 'unknown', lastCheckedAt: new Date() },
            });
    }
    // Payment truth may arrive after either a locally accepted pre-handoff
    // cancellation or an authoritative CRM-cancelled projection. In both cases
    // fulfillment stays cancelled and payment converges through one durable,
    // deterministic refund intent.
    if (order.status === 'cancelled' || order.cancellationState === 'accepted') {
        const refundEvent = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, order.id);
            const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
            const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
            if (!currentOrder || !currentAttempt?.providerPaymentId) {
                throw new Error('Cancelled order has no durable provider payment identity');
            }
            const postHandoff = Boolean(currentOrder.crmOrderId && currentOrder.status === 'cancelled');
            const preHandoff = Boolean(!currentOrder.crmOrderId
                && (currentOrder.status === 'cancelled' || currentOrder.cancellationState === 'accepted'));
            if (!postHandoff && !preHandoff) {
                // CRM accepted the cancellation, but its authoritative cancelled
                // projection may still be in the durable status outbox. Persist payment
                // truth now; that projection will atomically create the refund intent.
                if (currentOrder.crmOrderId && currentOrder.cancellationState === 'accepted') {
                    await tx.paymentAttempt.update({
                        where: { id: currentAttempt.id },
                        data: {
                            status: ['refunded', 'refund_required', 'refund_failed'].includes(currentAttempt.status)
                                ? currentAttempt.status
                                : 'succeeded',
                            providerConfirmedAt: currentAttempt.providerConfirmedAt || new Date(),
                            lastCheckedAt: new Date(),
                        },
                    });
                }
                return null;
            }
            if (currentAttempt.status === 'refunded')
                return null;
            const reason = postHandoff
                ? 'post_handoff_cancellation'
                : (currentOrder.cancellationState === 'accepted'
                    ? 'pre_handoff_customer_cancellation'
                    : 'pre_handoff_compensation');
            const requiredStatus = postHandoff ? 'refund_required' : 'compensation_required';
            await tx.paymentAttempt.update({
                where: { id: currentAttempt.id },
                data: {
                    status: currentAttempt.status === 'refund_failed' ? 'refund_failed' : requiredStatus,
                    providerConfirmedAt: currentAttempt.providerConfirmedAt || new Date(),
                    lastCheckedAt: new Date(),
                    refundReason: reason,
                    refundRequestedAt: currentAttempt.refundRequestedAt || new Date(),
                    lastError: currentAttempt.status === 'refund_failed' ? currentAttempt.lastError : null,
                },
            });
            if (preHandoff) {
                await tx.outboxEvent.updateMany({
                    where: {
                        aggregateId: order.id,
                        type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
                        processedAt: null,
                    },
                    data: {
                        status: 'completed', processedAt: new Date(), lockedAt: null,
                        lastError: 'Stopped by cancelled pre-handoff workflow',
                    },
                });
                if (currentAttempt.reservationId) {
                    await (0, crmOutbox_service_1.ensureReservationReleaseOutboxEvent)(tx, order.id, currentAttempt.reservationId);
                }
            }
            return (0, crmOutbox_service_1.ensurePaymentRefundOutboxEvent)(tx, order.id, currentAttempt.providerPaymentId, currentAttempt.amountMinor, currentAttempt.currency, reason);
        }, { maxWait: 5000, timeout: 10000 });
        if (refundEvent)
            await (0, crmOutbox_service_1.dispatchPaymentRefundEvent)(refundEvent.id).catch(() => false);
        await redis_1.safeRedis.del(lockKey).catch(() => 0);
        return { success: true, orderId, status: 'paid', compensationRequired: true };
    }
    // A durable compensation workflow wins over any duplicate success signal.
    // Re-check under the same Order lock used by CRM/refund workers before a
    // legacy reservation can be acquired or a create event can be repaired.
    if (paymentAttempt?.status === 'compensation_required' && paymentAttempt.providerPaymentId) {
        const recovery = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, order.id);
            const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
            if (currentAttempt?.status !== 'compensation_required'
                || currentAttempt.providerPaymentId !== paymentAttempt.providerPaymentId)
                return null;
            const refund = await tx.outboxEvent.findUnique({
                where: { deduplicationKey: (0, crmOutbox_service_1.paymentRefundDeduplicationKey)(currentAttempt.providerPaymentId) },
            });
            if (refund)
                return { kind: 'refund', id: refund.id };
            let reconciliation = await tx.outboxEvent.findUnique({
                where: {
                    deduplicationKey: (0, crmOutbox_service_1.paymentReconciliationDeduplicationKey)(currentAttempt.providerPaymentId),
                },
            });
            if (!reconciliation && order.status === 'crm_failed') {
                const original = await tx.outboxEvent.findUnique({
                    where: { deduplicationKey: (0, crmOutbox_service_1.crmCreateDeduplicationKey)(order.id) },
                });
                const immutableOrderData = original?.payload?.orderData;
                if (immutableOrderData) {
                    reconciliation = await (0, crmOutbox_service_1.ensurePaymentReconciliationEvent)(tx, order.id, currentAttempt.providerPaymentId, immutableOrderData);
                }
            }
            if (reconciliation) {
                await (0, crmOutbox_service_1.acceleratePaymentReconciliationEvent)(tx, reconciliation.id);
                return { kind: 'reconciliation', id: reconciliation.id };
            }
            return { kind: 'guarded', id: null };
        });
        if (recovery?.kind === 'refund') {
            await (0, crmOutbox_service_1.dispatchPaymentRefundEvent)(recovery.id).catch(() => false);
        }
        else if (recovery?.kind === 'reconciliation') {
            await (0, crmOutbox_service_1.dispatchPaymentReconciliationEvent)(recovery.id).catch(() => false);
        }
        await redis_1.safeRedis.del(lockKey).catch(() => 0);
        return { success: true, orderId, status: 'paid', alreadyProcessed: true, compensationRequired: true };
    }
    // Pending provider payments that existed during rollout have no reservation.
    // Acquire one before accepting success, or durably refund if stock/price can
    // no longer be honored.
    if (paymentAttempt && !paymentAttempt.reservationId) {
        try {
            paymentAttempt = await (0, paymentAttempt_service_1.ensureCrmReservation)(order, paymentAttempt);
        }
        catch (error) {
            if (!paymentAttempt.providerPaymentId)
                throw error;
            const refundEvent = await prisma_1.prisma.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, order.id);
                const orderUpdated = await tx.order.updateMany({
                    where: {
                        id: order.id, crmOrderId: null,
                        status: { in: ['pending', 'paid', 'crm_failed'] },
                    },
                    data: { status: 'paid', updatedAt: new Date() },
                });
                const attemptUpdated = await tx.paymentAttempt.updateMany({
                    where: {
                        id: paymentAttempt.id,
                        status: { notIn: ['refunded', 'canceled'] },
                    },
                    data: {
                        status: 'compensation_required',
                        providerConfirmedAt: new Date(),
                        lastCheckedAt: new Date(),
                        lastError: `Legacy payment could not acquire stock reservation: ${String(error?.message || error).slice(0, 800)}`,
                    },
                });
                if (orderUpdated.count !== 1 || attemptUpdated.count !== 1) {
                    throw new Error('Legacy refund state changed concurrently');
                }
                return (0, crmOutbox_service_1.ensurePaymentRefundOutboxEvent)(tx, order.id, paymentAttempt.providerPaymentId, paymentAttempt.amountMinor, paymentAttempt.currency);
            });
            await (0, crmOutbox_service_1.dispatchPaymentRefundEvent)(refundEvent.id).catch(() => false);
            await redis_1.safeRedis.del(lockKey);
            return { success: true, orderId, status: 'paid', compensationRequired: true };
        }
    }
    const baseCrmPayload = (0, crmOrderPayload_service_1.buildCrmOrderPayload)(order);
    const durableCrmPayload = paymentAttempt?.reservationId && order.paymentId
        ? {
            ...baseCrmPayload,
            reservationId: paymentAttempt.reservationId,
            paymentId: order.paymentId,
            paidAmountMinor: paymentAttempt.amountMinor,
            currency: paymentAttempt.currency,
            contractVersion: 1,
        }
        : baseCrmPayload;
    if (order.status === 'crm_failed'
        && !order.crmOrderId
        && paymentAttempt?.status === 'compensation_required'
        && paymentAttempt.providerPaymentId) {
        const reconciliation = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, order.id);
            const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
            const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
            if (!currentOrder || currentOrder.crmOrderId || currentOrder.status !== 'crm_failed'
                || currentAttempt?.status !== 'compensation_required'
                || currentAttempt.providerPaymentId !== paymentAttempt.providerPaymentId)
                return null;
            const refundWorkflow = await tx.outboxEvent.findUnique({
                where: { deduplicationKey: (0, crmOutbox_service_1.paymentRefundDeduplicationKey)(currentAttempt.providerPaymentId) },
            });
            if (refundWorkflow)
                return null;
            const original = await tx.outboxEvent.findUnique({
                where: { deduplicationKey: (0, crmOutbox_service_1.crmCreateDeduplicationKey)(order.id) },
            });
            const immutableOrderData = original?.payload?.orderData;
            if (!immutableOrderData) {
                throw new Error('Immutable CRM payload is unavailable for payment reconciliation');
            }
            const event = await (0, crmOutbox_service_1.ensurePaymentReconciliationEvent)(tx, order.id, currentAttempt.providerPaymentId, immutableOrderData);
            await (0, crmOutbox_service_1.acceleratePaymentReconciliationEvent)(tx, event.id);
            return event;
        });
        if (reconciliation) {
            await (0, crmOutbox_service_1.dispatchPaymentReconciliationEvent)(reconciliation.id).catch(() => false);
        }
        await redis_1.safeRedis.del(lockKey).catch(() => 0);
        return { success: true, orderId, status: 'paid', alreadyProcessed: true, compensationRequired: true };
    }
    if (order.status !== 'pending' && order.status !== 'crm_failed') {
        if (order.status === 'paid' && !order.crmOrderId) {
            const repairedEvent = await (0, crmOutbox_service_1.ensureCrmCreateOutboxEvent)(prisma_1.prisma, order.id, durableCrmPayload);
            await (0, crmOutbox_service_1.dispatchCrmOutboxEvent)(repairedEvent.id).catch(() => false);
        }
        logger_1.log.info(`ℹ️ Оплата заказа ${orderId} уже обработана, пропускаем`);
        await redis_1.safeRedis.del(lockKey);
        return { success: true, orderId, status: 'paid', alreadyProcessed: true };
    }
    (0, orderStatus_1.assertOrderStatusTransition)(order.status, 'paid');
    const { claimed, outboxEvent } = await prisma_1.prisma.$transaction(async (tx) => {
        await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
        const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
        if (!currentOrder)
            throw new Error(`Заказ ${orderId} не найден`);
        const claimedResult = await tx.order.updateMany({
            where: {
                id: orderId,
                status: { in: ['pending', 'crm_failed'] },
                cancellationState: { notIn: ['requested', 'accepted'] },
            },
            data: { status: 'paid', updatedAt: new Date() },
        });
        if (claimedResult.count !== 1)
            return { claimed: claimedResult, outboxEvent: null };
        if (paymentAttempt) {
            await tx.paymentAttempt.update({
                where: { id: paymentAttempt.id },
                data: { status: 'succeeded', providerConfirmedAt: new Date(), lastCheckedAt: new Date() },
            });
        }
        const event = currentOrder.crmOrderId
            ? null
            : await (0, crmOutbox_service_1.ensureCrmCreateOutboxEvent)(tx, order.id, durableCrmPayload);
        const emailData = {
            orderId: order.id,
            documentNumber: order.orderNumber || order.id.slice(0, 8),
            customerName: [order.customerFirstName, order.customerMiddleName, order.customerLastName].filter(Boolean).join(' ') || order.guestName || [order.user?.firstName, order.user?.middleName, order.user?.lastName].filter(Boolean).join(' ') || 'Клиент',
            customerEmail: order.customerEmail || order.guestEmail || order.user?.email || '',
            customerPhone: order.customerPhone || order.guestPhone || order.user?.phone || '',
            total: order.total,
            items: order.items.map((item) => ({
                name: item.name || 'Товар',
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
            })),
            deliveryAddress: order.deliveryAddress || '',
            comment: order.comment || '',
            paymentId: order.paymentId || 'test',
        };
        await (0, email_service_1.sendOrderConfirmationToCustomer)(emailData, tx);
        await (0, email_service_1.sendOrderNotificationToManager)(emailData, tx, 'payment_succeeded');
        return { claimed: claimedResult, outboxEvent: event };
    });
    if (claimed.count !== 1) {
        await redis_1.safeRedis.del(lockKey);
        const latestOrder = await prisma_1.prisma.order.findUnique({ where: { id: orderId } });
        if (latestOrder?.status === 'cancelled' || latestOrder?.cancellationState === 'accepted') {
            return (0, exports.handlePaymentSuccess)(orderId);
        }
        return { success: true, orderId, status: 'paid', alreadyProcessed: true };
    }
    if (outboxEvent) {
        await (0, crmOutbox_service_1.dispatchCrmOutboxEvent)(outboxEvent.id).catch(() => false);
    }
    logger_1.log.info(`✅ Заказ ${orderId} оплачен!`);
    // ✅ 1. ОТПРАВЛЯЕМ ЗАКАЗ В CRM ЧЕРЕЗ ОЧЕРЕДЬ
    if (!order.crmOrderId) {
        try {
            const phone = cleanPhone(order.customerPhone || order.guestPhone || order.user?.phone || '');
            const orderData = {
                items: order.items.map((item) => ({
                    productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                })),
                client: {
                    firstName: order.user?.firstName || 'Клиент',
                    lastName: order.user?.lastName || '',
                    middleName: order.user?.middleName || '',
                    phone: phone || '+79999999999',
                    email: order.customerEmail || order.guestEmail || order.user?.email || '',
                    city: '',
                    address: order.deliveryAddress || '',
                },
                deliveryMethod: order.deliveryMethod || 'pickup',
                deliveryAddress: order.deliveryAddress || '',
                comment: order.comment || '',
                source: 'website'
            };
            // ✅ ДОБАВЛЯЕМ В ОЧЕРЕДЬ, А НЕ ОТПРАВЛЯЕМ ПРЯМО
            // The transactional outbox above is the sole CRM publisher. Keeping the
            // former direct Bull call here would recreate a DB/Redis split-brain path.
            logger_1.log.info(`✅ Заказ ${orderId} добавлен в очередь CRM`);
        }
        catch (error) {
            logger_1.log.error(`❌ Ошибка добавления заказа ${orderId} в очередь`, { error: error.message });
            await prisma_1.prisma.order.updateMany({
                where: { id: orderId, status: 'paid' },
                data: { status: 'crm_failed', updatedAt: new Date() },
            });
            await redis_1.safeRedis.del(lockKey);
            throw new Error('Оплата подтверждена, но синхронизация с CRM не запущена');
        }
    }
    else {
        logger_1.log.info(`ℹ️ Заказ ${orderId} уже имеет crmOrderId: ${order.crmOrderId}, пропускаем отправку в CRM`);
    }
    // Checkout already transfers the validated cart snapshot into Order and clears
    // that cart in the same transaction. Anything now in Cart is a new selection,
    // including re-added quantities of the same product. Payment must not alter it.
    // ✅ 5. СОХРАНЯЕМ В REDIS
    try {
        await redis_1.safeRedis.setex(processedKey, 7 * 24 * 60 * 60, 'true');
        await redis_1.safeRedis.del(lockKey);
        logger_1.log.debug(`✅ Ключи сохранены в Redis, блокировка снята`);
    }
    catch (error) {
        logger_1.log.warn('⚠️ Не удалось сохранить в Redis', { error });
    }
    logger_1.log.info(`✅ [handlePaymentSuccess] Заказ ${orderId} успешно обработан`);
    return {
        success: true,
        orderId,
        status: 'paid',
    };
};
exports.handlePaymentSuccess = handlePaymentSuccess;
// ============================================================
// ОБРАБОТКА WEBHOOK
// ============================================================
const handlePaymentWebhook = async (event) => {
    logger_1.log.info('YooKassa webhook received', { status: event.object?.status });
    const payment = event.object;
    if (!payment || !payment.metadata) {
        logger_1.log.error('❌ Невалидный webhook: нет metadata');
        throw new Error('Невалидный webhook');
    }
    const { orderId } = payment.metadata;
    const status = payment.status;
    if (!orderId) {
        logger_1.log.error('❌ Webhook: нет orderId в metadata');
        throw new Error('Нет orderId в metadata');
    }
    if (status === 'succeeded') {
        logger_1.log.info(`✅ Webhook: оплата заказа ${orderId} успешна`);
        return await (0, exports.handlePaymentSuccess)(orderId);
    }
    if (status === 'canceled') {
        const paymentState = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
            const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
            if (!currentOrder)
                throw new Error(`Заказ ${orderId} не найден`);
            const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
            if (attempt?.status === 'succeeded'
                || attempt?.status === 'compensation_required'
                || attempt?.status === 'refund_required'
                || attempt?.status === 'refund_failed'
                || attempt?.status === 'refunded') {
                if (attempt) {
                    await tx.paymentAttempt.update({
                        where: { id: attempt.id },
                        data: {
                            lastCheckedAt: new Date(),
                            lastError: 'PAYMENT_CANCELLATION_CONFLICT: fulfil/refund decision requires operator review',
                        },
                    });
                }
                return { conflict: true };
            }
            if (attempt) {
                const attemptUpdated = await tx.paymentAttempt.updateMany({
                    where: {
                        id: attempt.id,
                        status: {
                            notIn: ['succeeded', 'compensation_required', 'refund_required', 'refund_failed', 'refunded'],
                        },
                    },
                    data: { status: 'canceled', lastCheckedAt: new Date(), lastError: null },
                });
                if (attemptUpdated.count !== 1)
                    throw new Error('Payment cancellation state changed concurrently');
                if (attempt.reservationId) {
                    await (0, crmOutbox_service_1.ensureReservationReleaseOutboxEvent)(tx, orderId, attempt.reservationId);
                }
            }
            return { conflict: false };
        }, { maxWait: 5000, timeout: 10000 });
        if (paymentState.conflict) {
            throw new Error('PAYMENT_CANCELLATION_CONFLICT: operator review required');
        }
        logger_1.log.info(`Webhook: платёж заказа ${orderId} отменён; fulfillment status не изменён`);
        return { success: true, orderId, status: 'canceled' };
    }
    logger_1.log.info(`ℹ️ Webhook: заказ ${orderId}, статус ${status} (не обрабатывается)`);
    return { success: true, orderId, status };
};
exports.handlePaymentWebhook = handlePaymentWebhook;
// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ПЛАТЕЖА
// ============================================================
const getPaymentStatus = async (paymentId) => {
    if ((0, exports.getPaymentProvider)() === 'mock') {
        const payment = mockPayments.get(paymentId);
        if (!payment)
            throw new Error('Mock payment not found');
        return { ...payment, amount: { ...payment.amount }, metadata: { ...payment.metadata } };
    }
    try {
        assertYooKassaCredentials();
        const auth = Buffer.from(`${YOO_KASSA_SHOP_ID}:${YOO_KASSA_SECRET_KEY}`).toString('base64');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
        };
        const response = await axios_1.default.get(`${YOO_KASSA_API_URL}/payments/${paymentId}`, { headers, timeout: (0, paymentHttp_1.paymentHttpTimeoutMs)() });
        return response.data;
    }
    catch (error) {
        logger_1.log.error('❌ Ошибка получения статуса платежа', { status: Number(error?.response?.status) || undefined });
        const failure = new Error('Ошибка получения статуса платежа');
        const status = Number(error?.response?.status);
        // Preserve only the HTTP classification, never Axios credentials/body/URL.
        if (Number.isInteger(status) && status >= 100 && status <= 599)
            failure.response = { status };
        throw failure;
    }
};
exports.getPaymentStatus = getPaymentStatus;
const completeMockPayment = (paymentId, orderId) => {
    if (process.env.NODE_ENV === 'production' || (0, exports.getPaymentProvider)() !== 'mock') {
        throw new Error('Mock payment completion is unavailable');
    }
    const payment = mockPayments.get(paymentId);
    if (!payment || payment.metadata.orderId !== orderId) {
        throw new Error('Mock payment not found for this order');
    }
    payment.status = 'succeeded';
    return { ...payment, amount: { ...payment.amount }, metadata: { ...payment.metadata } };
};
exports.completeMockPayment = completeMockPayment;
const resetMockPaymentsForTests = () => {
    if (process.env.NODE_ENV !== 'test')
        throw new Error('Test helper is unavailable');
    mockPayments.clear();
};
exports.resetMockPaymentsForTests = resetMockPaymentsForTests;
// ============================================================
// ПРИНУДИТЕЛЬНАЯ ОТПРАВКА ЗАКАЗА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
const resendOrderToCRM = async (orderId) => {
    logger_1.log.info(`🔄 [resendOrderToCRM] Принудительная отправка заказа ${orderId} в CRM`);
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: {
                select: { firstName: true, lastName: true, middleName: true, phone: true, email: true },
            },
        },
    });
    if (!order) {
        throw new Error(`Заказ ${orderId} не найден`);
    }
    if (order.crmOrderId) {
        throw new Error(`Заказ ${orderId} уже отправлен в CRM (crmOrderId: ${order.crmOrderId})`);
    }
    if (order.status !== 'paid' && order.status !== 'crm_failed') {
        throw new Error(`Заказ ${orderId} не оплачен (статус: ${order.status})`);
    }
    const reconciliation = await prisma_1.prisma.$transaction(async (tx) => {
        await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
        const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
        if (!currentOrder || currentOrder.crmOrderId) {
            throw new Error(`Заказ ${orderId} уже обработан или не найден`);
        }
        if (currentOrder.status !== 'paid' && currentOrder.status !== 'crm_failed') {
            throw new Error(`Состояние заказа ${orderId} изменилось`);
        }
        const paymentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
        if (!paymentAttempt?.providerPaymentId || !paymentAttempt.reservationId) {
            throw new Error(`Заказ ${orderId} не имеет durable payment reservation`);
        }
        if (paymentAttempt.status === 'refunded' || paymentAttempt.status === 'canceled') {
            throw new Error(`Платёж заказа ${orderId} уже ${paymentAttempt.status}`);
        }
        const refund = await tx.outboxEvent.findUnique({
            where: { deduplicationKey: (0, crmOutbox_service_1.paymentRefundDeduplicationKey)(paymentAttempt.providerPaymentId) },
        });
        if (refund)
            throw new Error(`Для заказа ${orderId} уже запущен durable refund workflow`);
        const original = await tx.outboxEvent.findUnique({
            where: { deduplicationKey: (0, crmOutbox_service_1.crmCreateDeduplicationKey)(orderId) },
        });
        const immutableOrderData = original?.payload?.orderData;
        if (!immutableOrderData)
            throw new Error(`Immutable CRM payload для заказа ${orderId} не найден`);
        if (original.status === 'failed') {
            const replayed = await (0, crmDelivery_service_1.replayFailedCrmDelivery)(orderId, tx);
            return { id: replayed.id, kind: 'create' };
        }
        const event = await (0, crmOutbox_service_1.ensurePaymentReconciliationEvent)(tx, orderId, paymentAttempt.providerPaymentId, immutableOrderData);
        await (0, crmOutbox_service_1.acceleratePaymentReconciliationEvent)(tx, event.id);
        return { id: event.id, kind: 'reconciliation' };
    });
    if (reconciliation.kind === 'create') {
        await (0, crmOutbox_service_1.dispatchCrmOutboxEvent)(reconciliation.id).catch(() => false);
    }
    else {
        await (0, crmOutbox_service_1.dispatchPaymentReconciliationEvent)(reconciliation.id).catch(() => false);
    }
    return { success: true, orderId, queued: true, crmOrderId: null, documentNumber: null };
};
exports.resendOrderToCRM = resendOrderToCRM;
//# sourceMappingURL=payment.service.js.map