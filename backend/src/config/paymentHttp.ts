const DEFAULT_PAYMENT_HTTP_TIMEOUT_MS = 15_000;

export const paymentHttpTimeoutMs = (): number => {
  const value = process.env.PAYMENT_HTTP_TIMEOUT_MS?.trim();
  if (!value || !/^\d+$/.test(value)) return DEFAULT_PAYMENT_HTTP_TIMEOUT_MS;
  const milliseconds = Number(value);
  return Number.isSafeInteger(milliseconds) && milliseconds > 0 && milliseconds <= 120_000
    ? milliseconds
    : DEFAULT_PAYMENT_HTTP_TIMEOUT_MS;
};
