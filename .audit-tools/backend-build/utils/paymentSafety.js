"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noStartedPaymentWhere = void 0;
/**
 * Shared database predicate for physical deletion. The PaymentAttempt FK is the
 * final race-safe barrier; this predicate provides a clear conflict response.
 */
exports.noStartedPaymentWhere = {
    paymentId: null,
    paymentAttempts: { none: {} },
    invoice: { is: null },
};
//# sourceMappingURL=paymentSafety.js.map