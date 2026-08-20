/**
 * Shared database predicate for physical deletion. The PaymentAttempt FK is the
 * final race-safe barrier; this predicate provides a clear conflict response.
 */
export const noStartedPaymentWhere = {
  paymentId: null,
  paymentAttempts: { none: {} },
} as const;
