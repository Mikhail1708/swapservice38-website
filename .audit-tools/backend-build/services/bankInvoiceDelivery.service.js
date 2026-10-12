"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankInvoiceDeliveryService = exports.bankInvoiceReleaseKey = exports.bankInvoiceIntakeKey = exports.BANK_INVOICE_RELEASE_TYPE = exports.BANK_INVOICE_INTAKE_TYPE = void 0;
exports.ensureBankInvoiceIntake = ensureBankInvoiceIntake;
exports.ensureBankInvoiceRelease = ensureBankInvoiceRelease;
exports.createBankInvoiceDeliveryService = createBankInvoiceDeliveryService;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../config/prisma");
const invoiceSeller_1 = require("../config/invoiceSeller");
const invoiceBusinessDays_1 = require("../utils/invoiceBusinessDays");
const internalApiKey_1 = require("../utils/internalApiKey");
const paymentWorkflowLock_service_1 = require("./paymentWorkflowLock.service");
const invoiceEmail_service_1 = require("./invoiceEmail.service");
const crmDelivery_service_1 = require("./crmDelivery.service");
exports.BANK_INVOICE_INTAKE_TYPE = 'bank_invoice_intake_requested';
exports.BANK_INVOICE_RELEASE_TYPE = 'bank_invoice_release_requested';
const bankInvoiceIntakeKey = (id) => `bank-invoice-intake:${id}`;
exports.bankInvoiceIntakeKey = bankInvoiceIntakeKey;
const bankInvoiceReleaseKey = (id) => `bank-invoice-release:${id}`;
exports.bankInvoiceReleaseKey = bankInvoiceReleaseKey;
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
/** Caller holds the order workflow lock. The first payload remains immutable. */
async function ensureBankInvoiceIntake(tx, order, invoice, now = new Date()) {
    if (invoice.documentStatus !== 'preparing' || invoice.paymentStatus !== 'unpaid'
        || order.paymentMethod !== 'bank_invoice')
        throw new Error('Invoice is not eligible for intake');
    const key = (0, exports.bankInvoiceIntakeKey)(invoice.id);
    // Recovery/retry must reuse the immutable request, including legacy BI-* numbers.
    // The caller's order lock serializes this lookup with first-time allocation.
    const existing = await tx.outboxEvent.findUnique({ where: { deduplicationKey: key } });
    if (existing)
        return existing;
    const [allocated] = await tx.$queryRaw `
    SELECT nextval('bank_invoice_number_seq') AS value
  `;
    const invoiceNumber = String(allocated.value);
    if (!/^\d{5}$/.test(invoiceNumber))
        throw new Error('Invoice number is outside the supported five-digit range');
    const request = {
        contractVersion: 1, requestId: key, externalOrderId: order.id, invoiceId: invoice.id,
        invoiceNumber, issuedAt: now.toISOString(),
        dueAt: (0, invoiceBusinessDays_1.calculateInvoiceDueAt)(now).toISOString(), amountMinor: invoice.amountMinor.toString(),
        currency: invoice.currency, paymentMethod: 'bank_invoice', paymentStatus: 'unpaid',
        buyerSnapshot: invoice.buyerSnapshot, itemsSnapshot: invoice.itemsSnapshot,
        delivery: { method: order.deliveryMethod, address: order.deliveryAddress || null,
            provider: order.deliveryProvider || null, contactMethod: order.contactMethod,
            comment: order.comment || null },
    };
    return tx.outboxEvent.upsert({ where: { deduplicationKey: key }, create: {
            aggregateId: order.id, type: exports.BANK_INVOICE_INTAKE_TYPE, deduplicationKey: key,
            payload: { request, sellerSnapshot: { ...(0, invoiceSeller_1.createInvoiceSellerSnapshot)() } },
        }, update: {} });
}
async function ensureBankInvoiceRelease(tx, order, invoice, reason) {
    const key = (0, exports.bankInvoiceReleaseKey)(invoice.id);
    return tx.outboxEvent.upsert({ where: { deduplicationKey: key }, create: {
            aggregateId: order.id, type: exports.BANK_INVOICE_RELEASE_TYPE, deduplicationKey: key,
            payload: { externalOrderId: order.id, invoiceId: invoice.id, requestId: key, reason },
        }, update: {} });
}
function createBankInvoiceDeliveryService(db = prisma_1.prisma, post = axios_1.default.post) {
    async function dispatch(eventId) {
        const located = await db.outboxEvent.findUnique({ where: { id: eventId } });
        if (!located || ![exports.BANK_INVOICE_INTAKE_TYPE, exports.BANK_INVOICE_RELEASE_TYPE].includes(located.type))
            return false;
        const work = await db.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, located.aggregateId);
            const event = await tx.outboxEvent.findUnique({ where: { id: eventId } });
            if (!event || event.status !== 'pending' || event.processedAt || event.nextAttemptAt > new Date())
                return null;
            if (event.attempts >= crmDelivery_service_1.CRM_DELIVERY_MAX_ATTEMPTS) {
                await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lockedAt: null, lastError: 'CRM invoice delivery budget exhausted' } });
                return null;
            }
            const order = await tx.order.findUnique({ where: { id: event.aggregateId }, include: { invoice: true, paymentAttempts: true } });
            const payload = event.payload;
            const release = event.type === exports.BANK_INVOICE_RELEASE_TYPE;
            const request = release ? payload : payload?.request;
            if (!order?.invoice || order.paymentMethod !== 'bank_invoice' || request?.externalOrderId !== order.id
                || request?.invoiceId !== order.invoice.id || request.requestId !== (release ? exports.bankInvoiceReleaseKey : exports.bankInvoiceIntakeKey)(order.invoice.id)
                || order.invoice.paymentStatus !== 'unpaid'
                || order.paymentAttempts.some(a => !['canceled', 'failed'].includes(a.status))) {
                await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lastError: 'Invoice identity or payment conflict' } });
                return null;
            }
            if (!release && (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled')) {
                await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
                await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'completed', processedAt: new Date(), lockedAt: null } });
                return null;
            }
            if (!release && (request.amountMinor !== order.invoice.amountMinor.toString() || request.currency !== order.invoice.currency
                || !equal(request.buyerSnapshot, order.invoice.buyerSnapshot) || !equal(request.itemsSnapshot, order.invoice.itemsSnapshot))) {
                await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lastError: 'Immutable invoice payload mismatch' } });
                return null;
            }
            const claim = { id: event.id, orderId: order.id, attempts: event.attempts + 1, lockedAt: new Date() };
            await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'processing', attempts: claim.attempts, lockedAt: claim.lockedAt, lastError: null } });
            return { claim, release, request, payload };
        });
        if (!work)
            return false;
        const { claim, release, request, payload } = work;
        try {
            const base = process.env.CRM_API_URL || 'http://localhost:5000';
            const url = `${base}/api/sale-documents/internal/v1/invoice-orders${release ? `/${encodeURIComponent(claim.orderId)}/release` : ''}`;
            const response = await post(url, release ? { invoiceId: request.invoiceId, requestId: request.requestId, reason: request.reason } : request, { timeout: 15000, headers: { 'Content-Type': 'application/json', 'X-API-Key': (0, internalApiKey_1.getInternalApiKey)() } });
            const result = response.data;
            if (result?.contractVersion !== 1 || result.externalOrderId !== claim.orderId || result.invoiceId !== request.invoiceId
                || result.paymentMethod !== 'bank_invoice' || result.paymentStatus !== 'unpaid'
                || !['held', 'released'].includes(result.allocationStatus)
                || (release && result.allocationStatus !== 'released'))
                throw new Error('Invalid CRM invoice response');
            if (!release && result.allocationStatus === 'held' && (result.invoiceNumber !== request.invoiceNumber || result.amountMinor !== request.amountMinor
                || result.currency !== request.currency || result.dueAt !== request.dueAt))
                throw new Error('CRM invoice snapshot mismatch');
            if (result.allocationStatus === 'held' && (!Number.isSafeInteger(result.crmOrderId) || result.crmOrderId <= 0
                || typeof result.documentNumber !== 'string' || !result.documentNumber.trim()))
                throw new Error('CRM document identity missing');
            if (result.crmOrderId != null && (!Number.isSafeInteger(result.crmOrderId) || result.crmOrderId <= 0
                || typeof result.documentNumber !== 'string' || !result.documentNumber.trim()))
                throw new Error('Invalid CRM document identity');
            return await db.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, claim.orderId);
                const owned = await tx.outboxEvent.findFirst({ where: (0, crmDelivery_service_1.deliveryClaimWhere)(claim) });
                if (!owned)
                    return false; // A stale HTTP response may never finalize another worker's lease.
                const order = await tx.order.findUnique({ where: { id: claim.orderId }, include: { invoice: true, paymentAttempts: true } });
                if (!order?.invoice || order.invoice.id !== request.invoiceId || order.invoice.paymentStatus !== 'unpaid'
                    || order.paymentAttempts.some(a => !['canceled', 'failed'].includes(a.status)))
                    throw new Error('Invoice payment state changed');
                if (order.crmOrderId && result.crmOrderId != null && order.crmOrderId !== String(result.crmOrderId))
                    throw new Error('CRM identity conflict');
                if (result.allocationStatus === 'released') {
                    await tx.invoice.update({ where: { id: order.invoice.id }, data: { documentStatus: 'void' } });
                    await tx.order.update({ where: { id: order.id }, data: {
                            status: 'cancelled', cancellationState: 'accepted', cancellationResolvedAt: new Date(),
                            cancellationDecisionReason: 'bank_invoice_allocation_released',
                            ...(Number.isSafeInteger(result.statusVersion) && result.statusVersion >= 0
                                ? { crmStatusVersion: Math.max(order.crmStatusVersion || 0, result.statusVersion) } : {}),
                            ...(result.crmOrderId != null ? { crmOrderId: String(result.crmOrderId), orderNumber: result.documentNumber } : {}),
                        } });
                }
                else if (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled') {
                    await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
                }
                else {
                    await tx.order.update({ where: { id: order.id }, data: { crmOrderId: String(result.crmOrderId), orderNumber: result.documentNumber } });
                    if (!order.invoice.issuedAt) {
                        if (order.invoice.documentStatus !== 'preparing' || !equal(order.invoice.itemsSnapshot, request.itemsSnapshot)
                            || !equal(order.invoice.buyerSnapshot, request.buyerSnapshot) || order.invoice.amountMinor.toString() !== request.amountMinor)
                            throw new Error('Invoice changed before finalize');
                        const issuedInvoice = await tx.invoice.update({ where: { id: order.invoice.id }, data: {
                                documentStatus: 'issued', invoiceNumber: request.invoiceNumber,
                                issuedAt: new Date(request.issuedAt), dueAt: new Date(request.dueAt), sellerSnapshot: payload.sellerSnapshot,
                                orderNumberSnapshot: result.documentNumber,
                                paymentPurpose: `Оплата по счёту №${request.invoiceNumber} за товары по заказу №${result.documentNumber}. ${payload.sellerSnapshot.vatLabel}.`,
                            } });
                        await (0, invoiceEmail_service_1.persistInvoiceIssuedEmail)(tx, issuedInvoice);
                    }
                }
                const completed = await tx.outboxEvent.updateMany({ where: (0, crmDelivery_service_1.deliveryClaimWhere)(claim), data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null } });
                // Recovery may revoke a stale lease while this transaction finalizes.
                // Roll back the document/order writes unless this exact claim still owns it.
                if (completed.count !== 1)
                    throw new Error('Invoice delivery lease was lost during finalization');
                return true;
            });
        }
        catch (error) {
            // CRM serializes release against payment confirmation. A definitive business
            // refusal resolves the request; transport failures must remain retryable.
            if (release && error?.response?.status === 409
                && error?.response?.data?.code === 'INVOICE_RELEASE_FORBIDDEN') {
                return db.$transaction(async (tx) => {
                    await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, claim.orderId);
                    const owned = await tx.outboxEvent.findFirst({ where: (0, crmDelivery_service_1.deliveryClaimWhere)(claim) });
                    if (!owned)
                        return false;
                    const order = await tx.order.findUnique({ where: { id: claim.orderId }, include: { invoice: true } });
                    if (order?.cancellationState === 'requested') {
                        await tx.order.update({ where: { id: order.id }, data: {
                                cancellationState: 'rejected', cancellationResolvedAt: new Date(),
                                cancellationDecisionReason: order.invoice?.paymentStatus === 'paid' ? 'bank_invoice_already_paid' : 'bank_invoice_release_forbidden',
                            } });
                    }
                    const completed = await tx.outboxEvent.updateMany({ where: (0, crmDelivery_service_1.deliveryClaimWhere)(claim), data: {
                            status: 'completed', processedAt: new Date(), lockedAt: null, lastError: 'INVOICE_RELEASE_FORBIDDEN',
                        } });
                    if (completed.count !== 1)
                        throw new Error('Invoice release lease lost');
                    return false;
                });
            }
            const classification = (0, crmDelivery_service_1.classifyCrmDeliveryError)(error);
            await db.outboxEvent.updateMany({ where: (0, crmDelivery_service_1.deliveryClaimWhere)(claim), data: {
                    status: !classification.transient || claim.attempts >= crmDelivery_service_1.CRM_DELIVERY_MAX_ATTEMPTS ? 'failed' : 'pending',
                    lockedAt: null, nextAttemptAt: new Date(Date.now() + (0, crmDelivery_service_1.crmDeliveryDelayMs)(claim.attempts, classification.retryAfterMs)),
                    lastError: classification.diagnostic,
                } });
            return false;
        }
    }
    let cursor;
    async function recover() {
        const rows = await db.invoice.findMany({ where: { documentStatus: 'preparing', paymentStatus: 'unpaid' },
            orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 100 });
        cursor = rows.length === 100 ? rows[rows.length - 1].id : undefined;
        for (const row of rows)
            await db.$transaction(async (tx) => {
                await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, row.orderId);
                const order = await tx.order.findUnique({ where: { id: row.orderId }, include: { invoice: true } });
                if (!order?.invoice || order.invoice.documentStatus !== 'preparing' || order.paymentMethod !== 'bank_invoice')
                    return;
                if (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled') {
                    await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
                }
                else
                    await ensureBankInvoiceIntake(tx, order, order.invoice);
            });
    }
    async function replay(eventId) {
        const event = await db.outboxEvent.findUnique({ where: { id: eventId } });
        if (!event || ![exports.BANK_INVOICE_INTAKE_TYPE, exports.BANK_INVOICE_RELEASE_TYPE].includes(event.type))
            throw new Error('Invoice event not found');
        return db.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, event.aggregateId);
            return tx.outboxEvent.updateMany({ where: { id: eventId, status: 'failed', processedAt: null },
                data: { status: 'pending', attempts: 0, lockedAt: null, nextAttemptAt: new Date(), lastError: null } });
        });
    }
    return { dispatch, recover, replay };
}
exports.bankInvoiceDeliveryService = createBankInvoiceDeliveryService();
//# sourceMappingURL=bankInvoiceDelivery.service.js.map