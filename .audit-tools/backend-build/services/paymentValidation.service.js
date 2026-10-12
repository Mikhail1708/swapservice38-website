"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesAuthoritativePayment = exports.matchesDurablePaymentAttempt = exports.paymentAmountMinor = void 0;
// Shared authoritative-provider validation for webhook and background recovery.
const paymentAmountMinor = (payment) => {
    const value = payment?.amount?.value;
    return typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value)
        ? Math.round(Number(value) * 100) : NaN;
};
exports.paymentAmountMinor = paymentAmountMinor;
const matchesDurablePaymentAttempt = (order, payment, amountMinor) => {
    const attempt = order.paymentAttempts?.[0];
    if (!attempt)
        return true; // Payments predating durable attempts.
    return attempt.providerPaymentId === payment?.id
        && attempt.amountMinor === amountMinor
        && attempt.currency === payment?.amount?.currency
        && (!attempt.reservationId || payment?.metadata?.reservationId === attempt.reservationId);
};
exports.matchesDurablePaymentAttempt = matchesDurablePaymentAttempt;
const matchesAuthoritativePayment = (order, payment, paymentId) => {
    const amount = (0, exports.paymentAmountMinor)(payment);
    return payment?.id === paymentId
        && payment?.metadata?.orderId === order.id
        && payment?.amount?.currency === 'RUB'
        && Number.isSafeInteger(amount)
        && amount === Math.round(order.total * 100)
        && (0, exports.matchesDurablePaymentAttempt)(order, payment, amount);
};
exports.matchesAuthoritativePayment = matchesAuthoritativePayment;
//# sourceMappingURL=paymentValidation.service.js.map