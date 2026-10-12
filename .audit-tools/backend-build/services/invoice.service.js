"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderWithPaymentView = exports.publicInvoice = exports.invoiceDto = exports.invoiceService = exports.InvoiceError = void 0;
exports.invoiceAmountMinor = invoiceAmountMinor;
exports.buildInvoiceItemsSnapshot = buildInvoiceItemsSnapshot;
exports.prepareCheckoutInvoice = prepareCheckoutInvoice;
exports.createInvoiceService = createInvoiceService;
exports.invoiceReservationReleased = invoiceReservationReleased;
exports.loadOrderPaymentView = loadOrderPaymentView;
const prisma_1 = require("../config/prisma");
const invoice_schema_1 = require("../schemas/invoice.schema");
const paymentWorkflowLock_service_1 = require("./paymentWorkflowLock.service");
const orderPaymentView_service_1 = require("./orderPaymentView.service");
const bankInvoiceDelivery_service_1 = require("./bankInvoiceDelivery.service");
const paymentValidation_service_1 = require("./paymentValidation.service");
class InvoiceError extends Error {
    constructor(code, message, status = 409) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'InvoiceError';
    }
}
exports.InvoiceError = InvoiceError;
// Order still uses Float. Accept its ordinary binary rounding noise, but never
// round a genuinely fractional kopeck or cross Number's exact-integer boundary.
function invoiceAmountMinor(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new InvoiceError('INVALID_ORDER_AMOUNT', 'Некорректная сумма заказа');
    }
    const scaled = value * 100;
    const minor = Math.round(scaled);
    const tolerance = Math.min(0.00001, Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4);
    if (!Number.isSafeInteger(minor) || Math.abs(scaled - minor) > tolerance) {
        throw new InvoiceError('INVALID_ORDER_AMOUNT', 'Сумма должна быть выражена в целых копейках');
    }
    return BigInt(minor);
}
function buildInvoiceItemsSnapshot(items, total) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new InvoiceError('INVALID_ORDER_ITEMS', 'Заказ не содержит товаров');
    }
    let sum = 0n;
    const snapshot = items.map(item => {
        if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
            || !['string', 'number'].includes(typeof item.productId) || !String(item.productId).trim()
            || typeof item.name !== 'string' || !item.name.trim()) {
            throw new InvoiceError('INVALID_ORDER_ITEMS', 'Некорректные позиции заказа');
        }
        const price = invoiceAmountMinor(item.price);
        const line = price * BigInt(item.quantity);
        sum += line;
        return {
            productId: String(item.productId), name: item.name,
            sku: typeof item.sku === 'string' && item.sku.trim() ? item.sku.trim() : null,
            quantity: item.quantity, unitPriceMinor: price.toString(), totalMinor: line.toString(),
        };
    });
    const amountMinor = invoiceAmountMinor(total);
    if (amountMinor <= 0n || amountMinor !== sum) {
        throw new InvoiceError('ORDER_AMOUNT_MISMATCH', 'Итог заказа не совпадает с суммой позиций');
    }
    return { amountMinor, itemsSnapshot: snapshot };
}
/** Only for a freshly inserted, unpaid order in the same checkout transaction. */
async function prepareCheckoutInvoice(tx, order, buyer) {
    const parsed = invoice_schema_1.requestInvoiceSchema.safeParse({ buyer });
    if (!parsed.success)
        throw new InvoiceError('INVALID_INVOICE_BUYER', 'Некорректные реквизиты покупателя', 400);
    if (order.paymentMethod !== 'bank_invoice' || order.status !== 'pending' || order.paymentId || order.crmOrderId) {
        throw new InvoiceError('INVOICE_NOT_ALLOWED', 'Недопустимое состояние нового заказа');
    }
    const money = buildInvoiceItemsSnapshot(order.items, order.total);
    const invoice = await tx.invoice.create({ data: {
            orderId: order.id, amountMinor: money.amountMinor,
            itemsSnapshot: money.itemsSnapshot, buyerSnapshot: { ...parsed.data.buyer },
        } });
    await (0, bankInvoiceDelivery_service_1.ensureBankInvoiceIntake)(tx, order, invoice);
    return invoice;
}
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// PostgreSQL jsonb does not preserve key order.
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equalSnapshot = (a, b) => sameJson(canonical(a), canonical(b));
const authoritativePayment = async (paymentId) => {
    const { getPaymentStatus } = await Promise.resolve().then(() => __importStar(require('./payment.service')));
    return getPaymentStatus(paymentId);
};
/** Internal service: no public route, PDF or paid mutation.
 * Durable delivery finalizes issuance after confirmed CRM allocation.
 * The dependency seam is server-owned, never populated from a request body.
 */
function createInvoiceService(db = prisma_1.prisma, lookup = authoritativePayment, clock = () => new Date()) {
    async function canceledEvidence(orderId, userId) {
        const order = await db.order.findUnique({ where: { id: orderId }, include: { paymentAttempts: true } });
        if (!order || (userId !== undefined && order.userId !== userId)) {
            throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
        }
        const attempt = order.paymentAttempts[0];
        if (attempt?.status !== 'canceled' || !attempt.providerPaymentId || !attempt.reservationId)
            return null;
        // A local canceled flag alone is not proof. Re-fetch the exact provider payment.
        let payment;
        try {
            payment = await lookup(attempt.providerPaymentId);
        }
        catch {
            throw new InvoiceError('PAYMENT_RECONCILIATION_REQUIRED', 'Не удалось подтвердить отмену платежа');
        }
        if (payment?.status !== 'canceled' || !(0, paymentValidation_service_1.matchesAuthoritativePayment)(order, payment, attempt.providerPaymentId)) {
            throw new InvoiceError('PAYMENT_RECONCILIATION_REQUIRED', 'Необходима сверка онлайн-платежа');
        }
        return { id: attempt.id, paymentId: attempt.providerPaymentId, reservationId: attempt.reservationId,
            amountMinor: attempt.amountMinor, currency: attempt.currency };
    }
    async function released(tx, orderId, attempt, evidence) {
        if (!evidence || !attempt || evidence.id !== attempt.id || evidence.paymentId !== attempt.providerPaymentId
            || evidence.reservationId !== attempt.reservationId || attempt.status !== 'canceled'
            || evidence.amountMinor !== attempt.amountMinor || evidence.currency !== attempt.currency)
            return false;
        const event = await tx.outboxEvent.findUnique({
            where: { deduplicationKey: `crm-reservation-release:${attempt.reservationId}` },
        });
        const payload = event?.payload;
        return event?.type === 'crm_reservation_release_requested' && event.aggregateId === orderId
            && event.status === 'completed' && event.processedAt !== null
            && payload?.orderId === orderId && payload?.reservationId === attempt.reservationId;
    }
    async function prepare(orderId, userId, input) {
        if (!userId)
            throw new InvoiceError('UNAUTHORIZED', 'Необходима авторизация', 401);
        const parsed = invoice_schema_1.requestInvoiceSchema.safeParse(input);
        if (!parsed.success)
            throw new InvoiceError('INVALID_INVOICE_BUYER', 'Некорректные реквизиты или поля запроса', 400);
        // Fast idempotent read avoids external calls for a previously prepared invoice.
        const owned = await db.order.findFirst({ where: { id: orderId, userId }, include: { invoice: true } });
        if (!owned)
            throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
        if (owned.invoice) {
            if (!equalSnapshot(owned.invoice.buyerSnapshot, parsed.data.buyer)) {
                throw new InvoiceError('INVOICE_ALREADY_EXISTS', 'Для заказа уже сохранены другие реквизиты счёта');
            }
            return db.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
                const order = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
                if (!order?.invoice)
                    throw new InvoiceError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
                if (order.invoice.documentStatus === 'preparing' && !['requested', 'accepted'].includes(order.cancellationState) && order.status !== 'cancelled') {
                    await (0, bankInvoiceDelivery_service_1.ensureBankInvoiceIntake)(tx, order, order.invoice, clock());
                }
                return order.invoice;
            });
        }
        const evidence = await canceledEvidence(orderId, userId);
        return db.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, orderId);
            const order = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true, paymentAttempts: true } });
            if (!order || order.userId !== userId)
                throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
            if (order.invoice) {
                if (!equalSnapshot(order.invoice.buyerSnapshot, parsed.data.buyer)) {
                    throw new InvoiceError('INVOICE_ALREADY_EXISTS', 'Для заказа уже сохранены другие реквизиты счёта');
                }
                return order.invoice;
            }
            const attempt = order.paymentAttempts[0] || null;
            const reservationReleased = await released(tx, orderId, attempt, evidence);
            const view = (0, orderPaymentView_service_1.getOrderPaymentView)(order, attempt, null, { reservationReleased });
            if (!view.canRequestInvoice) {
                throw new InvoiceError('INVOICE_NOT_ALLOWED', 'Счёт недоступен: требуется проверка состояния заказа и оплаты');
            }
            const money = buildInvoiceItemsSnapshot(order.items, order.total);
            const invoice = await tx.invoice.create({ data: {
                    orderId, amountMinor: money.amountMinor,
                    itemsSnapshot: money.itemsSnapshot, buyerSnapshot: { ...parsed.data.buyer },
                } });
            // Reserve the payment branch before returning; the provider-start lock sees it.
            await tx.order.update({ where: { id: orderId }, data: { paymentMethod: 'bank_invoice' } });
            await (0, bankInvoiceDelivery_service_1.ensureBankInvoiceIntake)(tx, { ...order, paymentMethod: 'bank_invoice' }, invoice, clock());
            return invoice;
        }, { maxWait: 5000, timeout: 10000 });
    }
    // Issuance belongs to the fenced delivery transaction, after confirmed CRM allocation.
    async function issue(orderId, _now = new Date()) {
        const invoice = await db.invoice.findUnique({ where: { orderId } });
        if (!invoice)
            throw new InvoiceError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
        const event = await db.outboxEvent.findUnique({ where: { deduplicationKey: (0, bankInvoiceDelivery_service_1.bankInvoiceIntakeKey)(invoice.id) } });
        if (!invoice.issuedAt || event?.type !== bankInvoiceDelivery_service_1.BANK_INVOICE_INTAKE_TYPE || event.status !== 'completed' || !event.processedAt) {
            throw new InvoiceError('CRM_INVOICE_INTAKE_REQUIRED', 'Confirmed CRM invoice delivery is required');
        }
        return invoice;
    }
    return { prepare, issue };
}
exports.invoiceService = createInvoiceService();
// Explicit DTO boundary for future HTTP/outbox use: native bigint is not JSON.
const invoiceDto = (invoice) => ({
    ...invoice, amountMinor: invoice.amountMinor.toString(),
});
exports.invoiceDto = invoiceDto;
const publicInvoice = (invoice) => invoice ? (0, exports.invoiceDto)({
    id: invoice.id, orderId: invoice.orderId, invoiceNumber: invoice.invoiceNumber,
    documentStatus: invoice.documentStatus, paymentStatus: invoice.paymentStatus,
    amountMinor: invoice.amountMinor, currency: invoice.currency,
    issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, paidAt: invoice.paidAt,
    buyerSnapshot: invoice.buyerSnapshot, orderNumberSnapshot: invoice.orderNumberSnapshot,
    paymentPurpose: invoice.paymentPurpose, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt,
}) : null;
exports.publicInvoice = publicInvoice;
const orderWithPaymentView = (order, reservationReleased = false) => {
    const payment = (0, orderPaymentView_service_1.getOrderPaymentView)(order, order.paymentAttempts?.[0] || null, order.invoice || null, { reservationReleased });
    return { ...order, ...payment, payment, invoice: (0, exports.publicInvoice)(order.invoice) };
};
exports.orderWithPaymentView = orderWithPaymentView;
/** Display eligibility only: prepare() still re-verifies the provider under its workflow. */
async function invoiceReservationReleased(order, db = prisma_1.prisma) {
    const attempt = order?.paymentAttempts?.[0];
    if (order.invoice || !attempt?.reservationId || attempt.status !== 'canceled')
        return false;
    const event = await db.outboxEvent.findUnique({
        where: { deduplicationKey: `crm-reservation-release:${attempt.reservationId}` },
    });
    const payload = event?.payload;
    return event?.type === 'crm_reservation_release_requested' && event.aggregateId === order.id
        && event.status === 'completed' && event.processedAt != null
        && payload?.orderId === order.id && payload?.reservationId === attempt.reservationId;
}
async function loadOrderPaymentView(order) {
    return (0, exports.orderWithPaymentView)(order, await invoiceReservationReleased(order));
}
//# sourceMappingURL=invoice.service.js.map