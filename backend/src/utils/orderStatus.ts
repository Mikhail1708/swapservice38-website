export const ORDER_STATUSES = [
  'pending',
  'paid',
  'crm_failed',
  'confirmed',
  'assembling',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

const transitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set(['paid', 'crm_failed', 'cancelled']),
  paid: new Set(['confirmed', 'assembling', 'shipped', 'delivered', 'crm_failed', 'cancelled']),
  crm_failed: new Set(['paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']),
  confirmed: new Set(['assembling', 'shipped', 'delivered', 'cancelled']),
  assembling: new Set(['shipped', 'delivered', 'cancelled']),
  shipped: new Set(['delivered']),
  delivered: new Set(),
  cancelled: new Set(),
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);

/** Same-status updates are accepted to keep webhook/admin retries idempotent. */
export const canTransitionOrderStatus = (current: unknown, next: unknown): boolean =>
  isOrderStatus(current) && isOrderStatus(next) &&
  (current === next || transitions[current].has(next));

export class InvalidOrderStatusTransitionError extends Error {
  constructor(public readonly current: unknown, public readonly next: unknown) {
    super(`Invalid order status transition: ${String(current)} -> ${String(next)}`);
    this.name = 'InvalidOrderStatusTransitionError';
  }
}

/** Local admin/payment rules; authoritative CRM projections use versions. */
export function assertOrderStatusTransition(
  current: unknown,
  next: unknown,
): asserts next is OrderStatus {
  if (!canTransitionOrderStatus(current, next)) {
    throw new InvalidOrderStatusTransitionError(current, next);
  }
}

/**
 * Legacy CRM events without a version remain acceptable. Versioned events must
 * be strictly newer; equal versions are idempotent replays and older ones are stale.
 */
export const shouldApplyCrmStatusVersion = (
  currentVersion: number,
  incomingVersion: unknown,
): boolean => {
  if (incomingVersion === undefined || incomingVersion === null) return true;
  return Number.isInteger(incomingVersion) &&
    (incomingVersion as number) >= 0 &&
    (incomingVersion as number) > currentVersion;
};
