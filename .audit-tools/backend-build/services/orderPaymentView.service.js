"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderPaymentView = exports.isOnlinePaymentBlocked = void 0;
const PAID_ATTEMPT_STATUSES = new Set(['succeeded', 'compensation_required', 'refund_required', 'refund_failed']);
// Legacy online orders advance to CRM fulfillment only after payment.
const LEGACY_PAID_ORDER_STATUSES = new Set(['paid', 'crm_failed', 'confirmed', 'assembling', 'shipped', 'delivered']);
/** Blocks provider initiation, never webhook/reconciliation of an existing payment. */
const isOnlinePaymentBlocked = (order, invoice = null) => order.paymentMethod === 'bank_invoice' || invoice != null;
exports.isOnlinePaymentBlocked = isOnlinePaymentBlocked;
/**
 * reservationReleased is trusted server evidence, never request input. For a
 * canceled attempt the caller must also freshly verify the provider outcome
 * and reservation identity under the shared order workflow lock. A timestamp
 * alone is not authorization to switch payment methods.
 */
const getOrderPaymentView = (order, attempt = null, invoice = null, options = {}) => {
    const bankInvoice = (0, exports.isOnlinePaymentBlocked)(order, invoice);
    const onlinePaid = Boolean(attempt && PAID_ATTEMPT_STATUSES.has(attempt.status));
    const onlineRefunded = attempt?.status === 'refunded';
    const cancellationActive = ['requested', 'accepted'].includes(order.cancellationState || 'none');
    let paymentStatus;
    if (onlinePaid)
        paymentStatus = 'paid'; // Never hide real money behind an unpaid invoice.
    else if (invoice?.paymentStatus === 'paid')
        paymentStatus = 'paid';
    else if (onlineRefunded || invoice?.paymentStatus === 'refunded')
        paymentStatus = 'refunded';
    else if (invoice)
        paymentStatus = invoice.paymentStatus === 'unpaid' ? 'unpaid' : 'unknown';
    else if (!bankInvoice && LEGACY_PAID_ORDER_STATUSES.has(order.status))
        paymentStatus = 'paid';
    else if (attempt?.status === 'pending')
        paymentStatus = 'pending';
    else if (attempt && ['initiating', 'unknown'].includes(attempt.status))
        paymentStatus = 'unknown';
    else if (attempt?.status === 'canceled')
        paymentStatus = 'unpaid';
    else if (attempt?.status === 'failed')
        paymentStatus = attempt.providerRequestStartedAt || attempt.providerPaymentId ? 'unknown' : 'unpaid';
    else if (attempt || order.paymentId)
        paymentStatus = 'unknown';
    else
        paymentStatus = 'unpaid';
    let invoiceBlockedReason;
    if (invoice)
        invoiceBlockedReason = 'existing_invoice';
    else if (onlinePaid || paymentStatus === 'paid')
        invoiceBlockedReason = 'online_payment_paid';
    else if (onlineRefunded)
        invoiceBlockedReason = 'online_payment_refunded';
    else if (cancellationActive)
        invoiceBlockedReason = 'cancellation_active';
    else if (order.status !== 'pending')
        invoiceBlockedReason = 'order_not_pending';
    else if (order.crmOrderId)
        invoiceBlockedReason = 'crm_handoff';
    else if (attempt) {
        const confirmedCanceled = attempt.status === 'canceled'
            && Boolean(attempt.providerPaymentId)
            && Boolean(attempt.lastCheckedAt && Number.isFinite(attempt.lastCheckedAt.getTime()))
            && (!order.paymentId || order.paymentId === attempt.providerPaymentId);
        if (!confirmedCanceled)
            invoiceBlockedReason = 'online_payment_unresolved';
        else if (!attempt.reservationId || options.reservationReleased !== true)
            invoiceBlockedReason = 'reservation_not_released';
    }
    else if (order.paymentId)
        invoiceBlockedReason = 'online_payment_unresolved';
    return {
        paymentMethod: bankInvoice ? 'bank_invoice' : 'online',
        paymentStatus,
        // Pending/unknown online attempts may resume only through the existing
        // payment service and its idempotent retry checks; this is not a new attempt grant.
        canPayOnline: !bankInvoice && order.status === 'pending' && !cancellationActive
            && !order.crmOrderId && !['paid', 'refunded'].includes(paymentStatus),
        canRequestInvoice: invoiceBlockedReason === undefined,
        canDownloadInvoice: invoice?.documentStatus === 'issued' && Boolean(invoice.issuedAt),
        ...(invoiceBlockedReason ? { invoiceBlockedReason } : {}),
    };
};
exports.getOrderPaymentView = getOrderPaymentView;
//# sourceMappingURL=orderPaymentView.service.js.map