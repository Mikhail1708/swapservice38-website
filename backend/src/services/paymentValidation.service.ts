// Shared authoritative-provider validation for webhook and background recovery.
export const paymentAmountMinor = (payment: any): number => {
  const value = payment?.amount?.value;
  return typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value)
    ? Math.round(Number(value) * 100) : NaN;
};

export const matchesDurablePaymentAttempt = (order: any, payment: any, amountMinor: number): boolean => {
  const attempt = order.paymentAttempts?.[0];
  if (!attempt) return true; // Payments predating durable attempts.
  return attempt.providerPaymentId === payment?.id
    && attempt.amountMinor === amountMinor
    && attempt.currency === payment?.amount?.currency
    && (!attempt.reservationId || payment?.metadata?.reservationId === attempt.reservationId);
};

export const matchesAuthoritativePayment = (order: any, payment: any, paymentId: string): boolean => {
  const amount = paymentAmountMinor(payment);
  return payment?.id === paymentId
    && payment?.metadata?.orderId === order.id
    && payment?.amount?.currency === 'RUB'
    && Number.isSafeInteger(amount)
    && amount === Math.round(order.total * 100)
    && matchesDurablePaymentAttempt(order, payment, amount);
};
