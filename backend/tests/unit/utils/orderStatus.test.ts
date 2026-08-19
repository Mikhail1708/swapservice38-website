import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
  InvalidOrderStatusTransitionError,
  shouldApplyCrmStatusVersion,
} from '../../../src/utils/orderStatus';

describe('order status transitions', () => {
  it('accepts idempotent and forward transitions', () => {
    expect(canTransitionOrderStatus('paid', 'paid')).toBe(true);
    expect(canTransitionOrderStatus('paid', 'assembling')).toBe(true);
    expect(canTransitionOrderStatus('assembling', 'delivered')).toBe(true);
    expect(canTransitionOrderStatus('confirmed', 'shipped')).toBe(true);
    expect(canTransitionOrderStatus('confirmed', 'delivered')).toBe(true);
  });

  it('rejects backwards, terminal and unknown transitions', () => {
    expect(canTransitionOrderStatus('shipped', 'paid')).toBe(false);
    expect(canTransitionOrderStatus('delivered', 'cancelled')).toBe(false);
    expect(canTransitionOrderStatus('unknown', 'paid')).toBe(false);
  });

  it('provides a shared assertion for status writers', () => {
    expect(() => assertOrderStatusTransition('cancelled', 'paid'))
      .toThrow(InvalidOrderStatusTransitionError);
  });

  it('rejects replayed or stale versioned CRM statuses', () => {
    expect(shouldApplyCrmStatusVersion(2, 3)).toBe(true);
    expect(shouldApplyCrmStatusVersion(2, 2)).toBe(false);
    expect(shouldApplyCrmStatusVersion(2, 1)).toBe(false);
    expect(shouldApplyCrmStatusVersion(2, undefined)).toBe(true);
  });
});
