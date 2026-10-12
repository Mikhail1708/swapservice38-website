"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookHealthCheck = exports.handleOrderStatusWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const orderStatus_1 = require("../utils/orderStatus");
const email_service_1 = require("../services/email.service");
const paymentWorkflowLock_service_1 = require("../services/paymentWorkflowLock.service");
const crmOutbox_service_1 = require("../services/crmOutbox.service");
const prisma_1 = require("../config/prisma");
// Маппинг статусов из CRM в статусы сайта
const statusMap = {
    'ordered': 'pending',
    'assembling': 'assembling',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
    'paid': 'paid',
    'confirmed': 'confirmed',
};
const ensureAuthoritativeCancellationRefund = async (tx, order, now) => {
    if (!order.crmOrderId || order.status !== 'cancelled')
        return;
    const paymentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
    if (!paymentAttempt?.providerPaymentId
        || !['succeeded', 'compensation_required', 'refund_failed'].includes(paymentAttempt.status))
        return;
    await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
            status: paymentAttempt.status === 'refund_failed' ? 'refund_failed' : 'refund_required',
            refundReason: 'post_handoff_cancellation',
            refundRequestedAt: paymentAttempt.refundRequestedAt || now,
            lastCheckedAt: now,
            lastError: paymentAttempt.status === 'refund_failed' ? paymentAttempt.lastError : null,
        },
    });
    await (0, crmOutbox_service_1.ensurePaymentRefundOutboxEvent)(tx, order.id, paymentAttempt.providerPaymentId, paymentAttempt.amountMinor, paymentAttempt.currency, 'post_handoff_cancellation');
};
/**
 * Каноническая сериализация — сортировка ключей по алфавиту
 */
const canonicalStringify = (obj) => {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
        sortedObj[key] = obj[key];
    }
    return JSON.stringify(sortedObj);
};
/**
 * POST /api/webhooks/crm/order-status
 */
const handleOrderStatusWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const payload = req.body;
        const webhookSecret = process.env.WEBHOOK_SECRET;
        if (!signature) {
            console.error('❌ Webhook: Отсутствует подпись');
            res.status(401).json({ error: 'Missing signature' });
            return;
        }
        if (!webhookSecret) {
            console.error('Webhook: WEBHOOK_SECRET is not configured');
            res.status(503).json({ error: 'Webhook is not configured' });
            return;
        }
        else {
            const payloadString = canonicalStringify(payload);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', webhookSecret)
                .update(payloadString)
                .digest('hex');
            const expected = Buffer.from(expectedSignature, 'utf8');
            const received = Buffer.from(signature, 'utf8');
            const signatureMatches = expected.length === received.length && crypto_1.default.timingSafeEqual(expected, received);
            if (!signatureMatches) {
                console.error('❌ Webhook: Неверная подпись');
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
        }
        const { crmOrderId, status, documentNumber, version, externalOrderId, paymentMethod, paymentStatus, invoiceId, invoiceNumber, amountMinor, currency, paidAt, paymentConfirmationId, } = payload;
        if (!crmOrderId || !status) {
            console.error('❌ Webhook: Отсутствуют обязательные поля');
            res.status(400).json({ error: 'Missing crmOrderId or status' });
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(statusMap, status)) {
            res.status(400).json({ error: 'Unknown order status' });
            return;
        }
        if (!Number.isInteger(version) || version < 0) {
            res.status(400).json({ error: 'Invalid or missing status version' });
            return;
        }
        console.log(`📥 Получен вебхук: заказ ${documentNumber || crmOrderId} → статус "${status}"`);
        const siteStatus = statusMap[status];
        console.log(`🔄 Маппинг статуса: ${status} → ${siteStatus}`);
        const locatedOrder = await prisma_1.prisma.order.findFirst({
            where: {
                crmOrderId: String(crmOrderId),
            },
            include: { invoice: true },
        });
        if (!locatedOrder) {
            console.warn(`⚠️ Webhook: Заказ с crmOrderId=${crmOrderId} не найден в БД сайта`);
            res.status(404).json({
                success: false,
                message: `Order with crmOrderId ${crmOrderId} not found`,
            });
            return;
        }
        const projection = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, locatedOrder.id);
            const order = await tx.order.findUnique({ where: { id: locatedOrder.id }, include: { invoice: true } });
            if (!order || order.crmOrderId !== String(crmOrderId)) {
                throw new Error('Order identity changed during CRM projection');
            }
            if (externalOrderId !== undefined && externalOrderId !== order.id) {
                throw new Error('CRM external order identity conflict');
            }
            if (order.paymentMethod === 'bank_invoice') {
                if (paymentMethod !== 'bank_invoice' || !['unpaid', 'paid'].includes(paymentStatus)
                    || typeof invoiceId !== 'string' || invoiceId !== order.invoice?.id
                    || invoiceNumber !== order.invoice?.invoiceNumber
                    || amountMinor !== order.invoice?.amountMinor.toString()
                    || currency !== order.invoice?.currency) {
                    throw new Error('CRM bank invoice payment projection is invalid');
                }
                if (paymentStatus === 'paid') {
                    if (typeof paymentConfirmationId !== 'string' || !paymentConfirmationId
                        || typeof paidAt !== 'string' || !Number.isFinite(Date.parse(paidAt))) {
                        throw new Error('CRM bank invoice confirmation is incomplete');
                    }
                    if (order.invoice.paymentStatus === 'unpaid') {
                        const paid = await tx.invoice.updateMany({
                            where: { id: order.invoice.id, paymentStatus: 'unpaid', documentStatus: 'issued' },
                            data: { paymentStatus: 'paid', paidAt: new Date(paidAt) },
                        });
                        if (paid.count !== 1)
                            throw new Error('Invoice payment projection was concurrently changed');
                    }
                    else if (order.invoice.paymentStatus !== 'paid') {
                        throw new Error('Invoice payment state conflict');
                    }
                }
                else if (order.invoice.paymentStatus === 'paid') {
                    // A signed older unpaid status may never downgrade a confirmed payment.
                    return { applied: false, order };
                }
            }
            if (!(0, orderStatus_1.shouldApplyCrmStatusVersion)(order.crmStatusVersion, version)) {
                await ensureAuthoritativeCancellationRefund(tx, order, new Date());
                return { applied: false, order };
            }
            // This signed, newer CRM event is an authoritative projection, not a local
            // workflow transition. CRM owns manual reversals and their stock guards.
            // Keep local payment/admin transition rules separate; statusMap above
            // still limits the accepted statuses and the locked version check orders them.
            const now = new Date();
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: siteStatus,
                    crmStatusVersion: version,
                    updatedAt: now,
                    ...(order.paymentMethod === 'bank_invoice' && paymentStatus === 'paid' && order.cancellationState === 'requested'
                        ? { cancellationState: 'rejected', cancellationResolvedAt: now, cancellationDecisionReason: 'bank_invoice_already_paid' }
                        : {}),
                    ...(siteStatus === 'cancelled' && order.cancellationState === 'requested'
                        ? {
                            cancellationState: 'accepted',
                            cancellationResolvedAt: now,
                            cancellationDecisionReason: 'authoritative_crm_cancelled',
                        }
                        : {}),
                },
            });
            await ensureAuthoritativeCancellationRefund(tx, updatedOrder, now);
            const customerName = [
                updatedOrder.customerFirstName,
                updatedOrder.customerMiddleName,
                updatedOrder.customerLastName,
            ].filter(Boolean).join(' ') || updatedOrder.guestName || 'Клиент';
            await (0, email_service_1.sendOrderStatusUpdateToCustomer)({
                orderId: updatedOrder.id,
                documentNumber: documentNumber || updatedOrder.orderNumber || String(crmOrderId),
                customerName,
                customerEmail: updatedOrder.customerEmail || updatedOrder.guestEmail || '',
                status: siteStatus,
                version,
            }, tx);
            return { applied: true, order: updatedOrder };
        }, { maxWait: 5000, timeout: 10000 });
        if (!projection.applied) {
            res.status(200).json({
                success: true,
                idempotent: true,
                message: `CRM status version ${version} was already applied or is stale`,
            });
            return;
        }
        const order = projection.order;
        console.log(`✅ Webhook: Заказ ${order.id} (crmOrderId: ${crmOrderId}) обновлён → статус "${siteStatus}"`);
        res.status(200).json({
            success: true,
            message: `Order ${order.id} status updated to ${siteStatus}`,
        });
    }
    catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleOrderStatusWebhook = handleOrderStatusWebhook;
/**
 * GET /api/webhooks/crm/health
 */
const webhookHealthCheck = async (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'crm-webhook-receiver',
        webhookSecret: process.env.WEBHOOK_SECRET ? '✅ set' : '❌ missing',
        env: process.env.NODE_ENV || 'development',
    });
};
exports.webhookHealthCheck = webhookHealthCheck;
//# sourceMappingURL=webhook.controller.js.map