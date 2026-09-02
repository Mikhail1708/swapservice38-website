const DEFAULT_PAYMENT_HOSTS = ['yoomoney.ru'];

const isSameOriginPath = (value: string): boolean => {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  try {
    return new URL(value, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

export const getSafeInternalRedirect = (value: string | null, fallback = '/'): string => (
  value && isSameOriginPath(value) ? value : fallback
);

export const getSafePaymentRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value) return null;
  if (isSameOriginPath(value)) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const configuredHosts = (import.meta.env.VITE_PAYMENT_REDIRECT_HOSTS || '')
      .split(',')
      .map((host: string) => host.trim().toLowerCase())
      .filter(Boolean);
    const allowedHosts = [...DEFAULT_PAYMENT_HOSTS, ...configuredHosts];
    const hostname = url.hostname.toLowerCase();
    return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};
