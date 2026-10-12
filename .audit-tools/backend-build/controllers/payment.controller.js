"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeMockPaymentController = exports.resendPaymentController = exports.getPaymentStatusController = exports.paymentWebhookController = exports.confirmPaymentController = exports.createPaymentController = void 0;
const payment_service_1 = require("../services/payment.service");
const checkoutInventory_service_1 = require("../services/checkoutInventory.service");
const paymentAttempt_service_1 = require("../services/paymentAttempt.service");
const paymentWorkflowLock_service_1 = require("../services/paymentWorkflowLock.service");
const logger_1 = require("../config/logger");
const prisma_1 = require("../config/prisma");
const orderPaymentView_service_1 = require("../services/orderPaymentView.service");
const paymentValidation_service_1 = require("../services/paymentValidation.service");
const matchesUnboundPaymentAttempt = (attempt, payment, amountMinor) => (attempt
    && !attempt.providerPaymentId
    && attempt.amountMinor === amountMinor
    && attempt.currency === payment?.amount?.currency
    && typeof attempt.reservationId === 'string'
    && payment?.metadata?.reservationId === attempt.reservationId);
// ============================================================
// POST /api/payment/create — СОЗДАНИЕ ПЛАТЕЖА
// ============================================================
const createPaymentController = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user?.id;
        if (!orderId) {
            res.status(400).json({ error: 'Не указан ID заказа' });
            return;
        }
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        // ✅ ПРОВЕРЯЕМ ЗАКАЗ (ТОЛЬКО СВОЙ)
        const order = await prisma_1.prisma.order.findFirst({
            where: {
                id: orderId,
                userId: userId,
            },
            include: { invoice: true, paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        if ((0, orderPaymentView_service_1.isOnlinePaymentBlocked)(order, order.invoice)) {
            res.status(409).json({ code: 'BANK_INVOICE_ONLINE_BLOCKED', error: 'Заказ оплачивается по банковскому счёту' });
            return;
        }
        const latestAttempt = order.paymentAttempts?.[0];
        const hasConfirmedPayment = latestAttempt && [
            'succeeded',
            'compensation_required',
            'refund_required',
            'refund_failed',
            'refunded',
        ].includes(latestAttempt.status);
        // PaymentAttempt is payment truth. Order.status='paid' is retained only as
        // a backward-compatible fallback for rows that predate PaymentAttempt.
        if (hasConfirmedPayment || (!latestAttempt && order.status === 'paid')) {
            res.json({
                success: true,
                paymentId: 'already_paid',
                paymentUrl: `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
                status: 'paid',
            });
            return;
        }
        // ✅ ЕСЛИ ЗАКАЗ УЖЕ В CRM — НЕ БЛОКИРУЕМ ОПЛАТУ, А СОЗДАЁМ ПЛАТЁЖ
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
        const returnUrl = `${clientUrl}/payment/success?orderId=${orderId}`;
        const payment = await (0, payment_service_1.createPayment)(orderId, returnUrl);
        res.json({
            success: true,
            paymentId: payment.paymentId,
            paymentUrl: payment.paymentUrl,
            status: payment.status,
        });
    }
    catch (error) {
        logger_1.log.error('Payment creation failed', { error: error instanceof Error ? error.message : 'unknown' });
        if (error instanceof checkoutInventory_service_1.CheckoutInventoryError) {
            res.status(error.status).json({
                error: error.message,
                code: error.code,
                ...(error.details || {}),
            });
            return;
        }
        if (error instanceof paymentAttempt_service_1.PaymentPreparationError) {
            res.status(error.status).json({ error: error.message, code: error.code });
            return;
        }
        res.status(500).json({ code: 'PAYMENT_CREATE_FAILED', error: 'Не удалось начать оплату. Попробуйте ещё раз' });
    }
};
exports.createPaymentController = createPaymentController;
// ============================================================
// POST /api/payment/confirm — ПОДТВЕРЖДЕНИЕ ОПЛАТЫ (СО СТРАНИЦЫ УСПЕХА)
// ============================================================
const confirmPaymentController = async (req, res) => {
    try {
        const { orderId, paymentId } = req.body;
        const userId = req.user?.id;
        if (!orderId || !paymentId) {
            res.status(400).json({ error: 'Не указаны ID заказа или платежа' });
            return;
        }
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        // ✅ ПРОВЕРЯЕМ, ЧТО ЗАКАЗ ПРИНАДЛЕЖИТ ПОЛЬЗОВАТЕЛЮ
        const order = await prisma_1.prisma.order.findFirst({
            where: {
                id: orderId,
                userId: userId,
            },
            include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        if (!order.paymentId || order.paymentId !== paymentId) {
            res.status(409).json({ error: 'Платёж не связан с указанным заказом' });
            return;
        }
        // ✅ ЕСЛИ ЗАКАЗ УЖЕ ОБРАБОТАН — ВОЗВРАЩАЕМ УСПЕХ
        if (order.status === 'paid' && order.crmOrderId) {
            res.json({
                success: true,
                orderId,
                status: 'paid',
                alreadyProcessed: true,
                crmOrderId: order.crmOrderId,
                documentNumber: order.orderNumber,
            });
            return;
        }
        // Redirect на страницу успеха не является подтверждением оплаты.
        // Перепроверяем платёж непосредственно в YooKassa.
        const payment = await (0, payment_service_1.getPaymentStatus)(order.paymentId);
        const paymentAmountValue = payment?.amount?.value;
        const hasValidPaymentAmount = typeof paymentAmountValue === 'string'
            && /^\d+(?:\.\d{1,2})?$/.test(paymentAmountValue);
        const paymentAmountCents = hasValidPaymentAmount
            ? Math.round(Number(paymentAmountValue) * 100)
            : NaN;
        const orderAmountCents = Math.round(order.total * 100);
        if (payment?.id !== order.paymentId ||
            payment?.status !== 'succeeded' ||
            payment?.amount?.currency !== 'RUB' ||
            !Number.isSafeInteger(paymentAmountCents) ||
            paymentAmountCents !== orderAmountCents ||
            payment?.metadata?.orderId !== order.id ||
            !(0, paymentValidation_service_1.matchesDurablePaymentAttempt)(order, payment, paymentAmountCents)) {
            res.status(409).json({
                error: 'Платёж не подтверждён или его данные не соответствуют заказу',
                status: payment?.status || 'unknown',
            });
            return;
        }
        const result = await (0, payment_service_1.handlePaymentSuccess)(orderId);
        res.json(result);
    }
    catch (error) {
        logger_1.log.error('Payment confirmation failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ code: 'PAYMENT_CONFIRM_FAILED', error: 'Не удалось проверить оплату. Попробуйте позже' });
    }
};
exports.confirmPaymentController = confirmPaymentController;
// ============================================================
// POST /api/payment/webhook — WEBHOOK ОТ ЮKASSA
// ============================================================
const paymentWebhookController = async (req, res) => {
    try {
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
        const body = rawBody.toString('utf8');
        const event = JSON.parse(body);
        const notifiedPaymentId = event?.object?.id;
        if (typeof notifiedPaymentId !== 'string' || !notifiedPaymentId) {
            res.status(400).json({ error: 'Invalid payment notification' });
            return;
        }
        // YooKassa does not sign these notifications with a shared-secret HMAC.
        // Treat the notification as a hint and fetch the authoritative payment.
        const payment = await (0, payment_service_1.getPaymentStatus)(notifiedPaymentId);
        const orderId = payment?.metadata?.orderId;
        if (payment?.id !== notifiedPaymentId || typeof orderId !== 'string' || !orderId) {
            res.status(400).json({ error: 'Invalid payment data' });
            return;
        }
        let order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!order) {
            res.status(409).json({ error: 'Payment is not linked to the order' });
            return;
        }
        const paymentAmountValue = payment?.amount?.value;
        const hasValidPaymentAmount = typeof paymentAmountValue === 'string'
            && /^\d+(?:\.\d{1,2})?$/.test(paymentAmountValue);
        const paymentAmountCents = hasValidPaymentAmount
            ? Math.round(Number(paymentAmountValue) * 100)
            : NaN;
        // Recover the exact crash window after YooKassa created the payment but
        // before its id was bound locally. The provider response is authoritative,
        // and the immutable reservation/amount facts prevent cross-order binding.
        const unboundAttempt = order.paymentAttempts?.[0];
        if (!order.paymentId
            && matchesUnboundPaymentAttempt(unboundAttempt, payment, paymentAmountCents)) {
            const linked = await prisma_1.prisma.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, order.id);
                const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
                if (!currentOrder || currentOrder.paymentId)
                    return false;
                const attemptResult = await tx.paymentAttempt.updateMany({
                    where: { id: unboundAttempt.id, providerPaymentId: null },
                    data: {
                        providerPaymentId: payment.id,
                        status: payment.status === 'succeeded' ? 'succeeded' : payment.status === 'canceled' ? 'canceled' : 'pending',
                        lastCheckedAt: new Date(),
                    },
                });
                if (attemptResult.count !== 1)
                    return false;
                const orderResult = await tx.order.updateMany({
                    where: { id: order.id, paymentId: null },
                    data: { paymentId: payment.id },
                });
                if (orderResult.count !== 1)
                    throw new Error('Concurrent payment binding conflict');
                return true;
            }, { maxWait: 5000, timeout: 10000 });
            if (linked) {
                order = {
                    ...order,
                    paymentId: payment.id,
                    paymentAttempts: [{ ...unboundAttempt, providerPaymentId: payment.id }],
                };
            }
        }
        if (!order.paymentId || order.paymentId !== payment.id) {
            res.status(409).json({ error: 'Payment is not linked to the order' });
            return;
        }
        if (payment.status === 'succeeded') {
            if (!(0, paymentValidation_service_1.matchesAuthoritativePayment)(order, payment, notifiedPaymentId)) {
                res.status(409).json({ error: 'Payment amount does not match the order' });
                return;
            }
        }
        const result = await (0, payment_service_1.handlePaymentWebhook)({ ...event, object: payment });
        res.json(result);
    }
    catch (error) {
        logger_1.log.error('Payment webhook failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Ошибка обработки webhook' });
    }
};
exports.paymentWebhookController = paymentWebhookController;
// ============================================================
// GET /api/payment/status/:paymentId — СТАТУС ПЛАТЕЖА
// ============================================================
const getPaymentStatusController = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user?.id;
        if (!paymentId) {
            res.status(400).json({ error: 'Не указан ID платежа' });
            return;
        }
        const id = Array.isArray(paymentId) ? paymentId[0] : paymentId;
        const attempt = await prisma_1.prisma.paymentAttempt.findFirst({
            where: { providerPaymentId: id, order: { userId } },
            select: { providerPaymentId: true },
        });
        if (!attempt) {
            res.status(404).json({ error: 'Платёж не найден' });
            return;
        }
        const status = await (0, payment_service_1.getPaymentStatus)(id);
        res.json({ paymentId: status.id, status: status.status, paid: status.paid === true });
    }
    catch (error) {
        logger_1.log.error('Payment status lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(503).json({ code: 'PAYMENT_STATUS_UNAVAILABLE', error: 'Не удалось получить статус платежа' });
    }
};
exports.getPaymentStatusController = getPaymentStatusController;
// ============================================================
// POST /api/payment/resend — ПРИНУДИТЕЛЬНАЯ ОТПРАВКА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
const resendPaymentController = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user?.id;
        if (!orderId) {
            res.status(400).json({ error: 'Не указан ID заказа' });
            return;
        }
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        // ✅ ПРОВЕРЯЕМ, ЧТО ПОЛЬЗОВАТЕЛЬ — АДМИН ИЛИ МЕНЕДЖЕР
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            res.status(403).json({ error: 'Доступ запрещён' });
            return;
        }
        const result = await (0, payment_service_1.resendOrderToCRM)(orderId);
        res.json(result);
    }
    catch (error) {
        logger_1.log.error('CRM resend failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Не удалось повторить отправку заказа' });
    }
};
exports.resendPaymentController = resendPaymentController;
const completeMockPaymentController = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production' || (0, payment_service_1.getPaymentProvider)() !== 'mock') {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const { orderId, paymentId } = req.body;
        const userId = req.user?.id;
        if (!orderId || !paymentId) {
            res.status(400).json({ error: 'Не указаны ID заказа или платежа' });
            return;
        }
        const order = await prisma_1.prisma.order.findFirst({ where: { id: orderId, userId } });
        if (!order || order.paymentId !== paymentId) {
            res.status(404).json({ error: 'Платёж не найден' });
            return;
        }
        const payment = (0, payment_service_1.completeMockPayment)(paymentId, orderId);
        res.json({ success: true, payment });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Ошибка mock-платежа' });
    }
};
exports.completeMockPaymentController = completeMockPaymentController;
//# sourceMappingURL=payment.controller.js.map