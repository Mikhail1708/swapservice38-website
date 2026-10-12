"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldApplyCrmStatusVersion = exports.InvalidOrderStatusTransitionError = exports.canTransitionOrderStatus = exports.isOrderStatus = exports.ORDER_STATUSES = void 0;
exports.assertOrderStatusTransition = assertOrderStatusTransition;
exports.ORDER_STATUSES = [
    'pending',
    'paid',
    'crm_failed',
    'confirmed',
    'assembling',
    'shipped',
    'delivered',
    'cancelled',
];
const transitions = {
    pending: new Set(['paid', 'crm_failed', 'cancelled']),
    paid: new Set(['confirmed', 'assembling', 'shipped', 'delivered', 'crm_failed', 'cancelled']),
    crm_failed: new Set(['paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']),
    confirmed: new Set(['assembling', 'shipped', 'delivered', 'cancelled']),
    assembling: new Set(['shipped', 'delivered', 'cancelled']),
    shipped: new Set(['delivered']),
    delivered: new Set(),
    cancelled: new Set(),
};
const isOrderStatus = (value) => typeof value === 'string' && exports.ORDER_STATUSES.includes(value);
exports.isOrderStatus = isOrderStatus;
/** Same-status updates are accepted to keep webhook/admin retries idempotent. */
const canTransitionOrderStatus = (current, next) => (0, exports.isOrderStatus)(current) && (0, exports.isOrderStatus)(next) &&
    (current === next || transitions[current].has(next));
exports.canTransitionOrderStatus = canTransitionOrderStatus;
class InvalidOrderStatusTransitionError extends Error {
    constructor(current, next) {
        super(`Invalid order status transition: ${String(current)} -> ${String(next)}`);
        this.current = current;
        this.next = next;
        this.name = 'InvalidOrderStatusTransitionError';
    }
}
exports.InvalidOrderStatusTransitionError = InvalidOrderStatusTransitionError;
/** Local admin/payment rules; authoritative CRM projections use versions. */
function assertOrderStatusTransition(current, next) {
    if (!(0, exports.canTransitionOrderStatus)(current, next)) {
        throw new InvalidOrderStatusTransitionError(current, next);
    }
}
/**
 * Legacy CRM events without a version remain acceptable. Versioned events must
 * be strictly newer; equal versions are idempotent replays and older ones are stale.
 */
const shouldApplyCrmStatusVersion = (currentVersion, incomingVersion) => {
    if (incomingVersion === undefined || incomingVersion === null)
        return true;
    return Number.isInteger(incomingVersion) &&
        incomingVersion >= 0 &&
        incomingVersion > currentVersion;
};
exports.shouldApplyCrmStatusVersion = shouldApplyCrmStatusVersion;
//# sourceMappingURL=orderStatus.js.map