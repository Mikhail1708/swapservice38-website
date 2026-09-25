jest.unmock('@queues/crm.queue');
import axios from 'axios';
import { prisma } from '../../../src/config/prisma';
import queue, { processCreateOrder } from '../../../src/queues/crm.queue';
import { beginCrmDeliveryHttpAttempt, claimCrmDelivery, finishCrmDeliveryFailure, replayFailedCrmDelivery, classifyCrmDeliveryError } from '../../../src/services/crmDelivery.service';
import { dispatchCrmOutboxEvent, reconcileCrmOutbox } from '../../../src/services/crmOutbox.service';

// Real queue/services with a stateful repository double; not PostgreSQL/CRM SQL.
const copy = <T>(v: T): T => structuredClone(v);
function matches(row: any, where: any): boolean {
  return Object.entries(where || {}).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((w: any) => matches(row, w));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((w: any) => matches(row, w));
    const actual = row[key];
    if (value instanceof Date) return typeof actual?.getTime === 'function' && actual.getTime() === value.getTime();
    if (value && typeof value === 'object') return Object.entries(value).every(([op, operand]: [string, any]) => {
      if (op === 'in') return operand.includes(actual);
      if (op === 'notIn') return !operand.includes(actual);
      if (op === 'not') return actual !== operand;
      if (op === 'lte') return actual <= operand;
      if (op === 'lt') return actual < operand;
      if (op === 'gte') return actual >= operand;
      if (op === 'gt') return actual > operand;
      throw new Error('Unsupported predicate ' + op);
    });
    return actual === value;
  });
}
function patch(row: any, data: any) {
  for (const [key, value] of Object.entries(data) as any) row[key] = value && typeof value === 'object' && 'increment' in value
    ? row[key] + value.increment : copy(value);
  row.updatedAt = new Date();
}
function repository(rows: () => any[]) {
  return {
    findUnique: jest.fn(async ({ where }) => copy(rows().find(r => matches(r, where)) || null)),
    findMany: jest.fn(async ({ where } = {} as any) => copy(rows().filter(r => matches(r, where)))),
    updateMany: jest.fn(async ({ where, data }) => {
      const found = rows().filter(r => matches(r, where)); found.forEach(r => patch(r, data)); return { count: found.length };
    }),
    update: jest.fn(async ({ where, data }) => {
      const row = rows().find(r => matches(r, where)); if (!row) throw new Error('Missing fixture row'); patch(row, data); return copy(row);
    }),
    upsert: jest.fn(async ({ where, create, update }) => {
      let row = rows().find(r => matches(r, where));
      if (row) patch(row, update);
      else { row = { id: 'event-' + rows().length, status: 'pending', attempts: 0, processedAt: null, lockedAt: null, lastError: null, nextAttemptAt: new Date(0), updatedAt: new Date(), ...copy(create) }; rows().push(row); }
      return copy(row);
    }),
  };
}
let order: any, attempt: any, events: any[], original: any;
const db = prisma as any;
const http = axios as jest.Mocked<typeof axios>;
const event = () => events.find(e => e.id === 'create');
const run = (orderData = original) => processCreateOrder({ orderId: 'order-1', orderData: copy(orderData) });
const due = () => { event().nextAttemptAt = new Date(0); };
const failure = (status?: number, code?: string, retryAfter?: string) => ({
  message: 'secret customer body https://private.invalid?api_key=SECRET',
  ...(status ? { response: { status, data: { code, customer: 'PRIVATE' }, headers: { 'retry-after': retryAfter } } } : {}),
});
const success = () => ({ data: { orderId: 42, documentNumber: 'ORDER-42', orderStatus: 'confirmed', statusVersion: 3 } });
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers({ now: new Date(2026, 8, 25) });
  order = { id: 'order-1', status: 'paid', crmOrderId: null, crmStatusVersion: 0, paymentId: 'payment-1', cancellationState: 'none' };
  attempt = { id: 'attempt-1', orderId: order.id, status: 'succeeded', providerPaymentId: 'payment-1', reservationId: 'reservation-1', amountMinor: 10000, currency: 'RUB' };
  original = { externalOrderId: order.id, contractVersion: 1, reservationId: attempt.reservationId, paymentId: attempt.providerPaymentId, paidAmountMinor: 10000, currency: 'RUB', items: [{ productId: 7, quantity: 2 }] };
  events = [{ id: 'create', aggregateId: order.id, type: 'crm_order_create_requested', deduplicationKey: 'crm-order-create:' + order.id, payload: { orderId: order.id, orderData: copy(original) }, status: 'pending', attempts: 0, nextAttemptAt: new Date(0), lockedAt: null, processedAt: null, lastError: null, updatedAt: new Date() }];
  Object.assign(db.order, repository(() => [order]));
  // Stranded-order scanning is covered separately in crmOutbox.service.test.
  db.order.findMany.mockResolvedValue([]);
  Object.assign(db.paymentAttempt, repository(() => [attempt]));
  Object.assign(db.outboxEvent, repository(() => events));
  db.$queryRaw.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (callback: any) => {
    const snapshot = copy({ order, attempt, events });
    try { return await callback(db); } catch (error) { ({ order, attempt, events } = snapshot); throw error; }
  });
  (queue as any).getJob.mockResolvedValue(null);
  (queue as any).add.mockReset().mockResolvedValue({ id: 'job' });
  http.post.mockReset().mockResolvedValue(success() as any);
});
afterEach(() => jest.useRealTimers());
describe('durable reserved CRM delivery recovery', () => {
  it.each([undefined, 500, 429])('retries %s only after durable nextAttemptAt and restores crm_failed', async status => {
    http.post.mockRejectedValueOnce(failure(status, undefined, '120'));
    const started = Date.now(); await run();
    expect(event()).toMatchObject({ status: 'pending', attempts: 1, processedAt: null });
    expect(event().nextAttemptAt.getTime()).toBeGreaterThanOrEqual(started + (status === 429 ? 120000 : 5000));
    expect(order.status).toBe('crm_failed');
    await run(); expect(http.post).toHaveBeenCalledTimes(1); expect(event().attempts).toBe(1);
    due(); await run();
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(event()).toMatchObject({ status: 'completed', attempts: 2 });
    expect(order).toMatchObject({ status: 'confirmed', crmOrderId: '42', crmStatusVersion: 3, paymentId: 'payment-1' });
    expect(attempt.status).toBe('succeeded');
  });
  it.each([400, 401, 403, 404, 409, 422])('keeps HTTP %s permanently failed across automatic scan/retry', async status => {
    http.post.mockRejectedValueOnce(failure(status)); await run();
    expect(event()).toMatchObject({ status: 'failed', attempts: 1, processedAt: null, lastError: 'CRM HTTP ' + status });
    event().updatedAt = new Date(0); due(); await reconcileCrmOutbox(); await run();
    expect(http.post).toHaveBeenCalledTimes(1); expect(event().status).toBe('failed');
    expect(JSON.stringify(event().lastError)).not.toMatch(/SECRET|PRIVATE|private.invalid|customer/);
  });
  it('allows exactly eight failing HTTP calls and never automatically revives exhausted delivery', async () => {
    http.post.mockRejectedValue(failure(503));
    for (let n = 1; n <= 8; n++) { due(); await run(); expect(http.post).toHaveBeenCalledTimes(n); expect(event().attempts).toBe(n); }
    expect(event()).toMatchObject({ status: 'failed', processedAt: null, lastError: 'CRM HTTP 503; budget exhausted' });
    due(); event().updatedAt = new Date(0); await reconcileCrmOutbox(); await dispatchCrmOutboxEvent('create'); await run();
    expect(http.post).toHaveBeenCalledTimes(8); expect(event().status).toBe('failed');
  });
  it('does not spend HTTP budget when Bull enqueue fails', async () => {
    (queue as any).add.mockRejectedValueOnce(new Error('Redis unavailable'));
    expect(await dispatchCrmOutboxEvent('create')).toBe(false);
    expect(event()).toMatchObject({ status: 'pending', attempts: 0 }); expect(http.post).not.toHaveBeenCalled();
  });
  it('manual replay preserves original immutable facts and previous failure diagnostic', async () => {
    Object.assign(event(), { status: 'failed', attempts: 8, lastError: 'CRM HTTP 503; budget exhausted' });
    await replayFailedCrmDelivery(order.id);
    expect(event()).toMatchObject({ status: 'pending', attempts: 0, payload: { orderData: original, previousDeliveryFailure: { attempts: 8, lastError: 'CRM HTTP 503; budget exhausted' } } });
    await run(); expect(event().status).toBe('completed'); expect(http.post.mock.calls[0][1]).toEqual(original);
  });
  it.each(['processing', 'dispatched'])('recovers stale %s after restart', async status => {
    Object.assign(event(), { status, lockedAt: new Date(0), updatedAt: new Date(0) }); event().payload.deliveryInFlight = true;
    await reconcileCrmOutbox(); expect(event().status).toBe('pending');
    await run(); expect(event()).toMatchObject({ status: 'completed', attempts: 1 });
  });
  it('replays lost committed response using canonical payload despite stale Bull identity', async () => {
    // Simulated idempotent CRM contract, not a test of CRM SQL/stock code.
    const documents = new Map<string, any>(); let consumes = 0;
    http.post.mockImplementation(async (url, payload: any) => {
      expect(url).toContain('/internal/v1/reservations/reservation-1/consume'); expect(payload).toEqual(original);
      const key = [payload.reservationId, payload.externalOrderId, payload.paymentId].join(':');
      if (!documents.has(key)) { documents.set(key, success()); consumes++; throw failure(); }
      return documents.get(key);
    });
    const stale = { ...original, contractVersion: 0, paymentId: 'wrong', reservationId: 'wrong', paidAmountMinor: 1, items: [] };
    await run(stale); due(); await run(stale);
    expect(http.post).toHaveBeenCalledTimes(2); expect(documents.size).toBe(1); expect(consumes).toBe(1);
    expect(order.crmOrderId).toBe('42'); expect(event().status).toBe('completed');
  });
  it('routes explicit RESERVATION_EXPIRED to durable compensation without another reservation or legacy call', async () => {
    http.post.mockRejectedValueOnce(failure(409, 'RESERVATION_EXPIRED')); await run();
    expect(attempt.status).toBe('compensation_required'); expect(event().status).toBe('completed');
    expect(events.filter(e => e.type === 'payment_refund_requested')).toHaveLength(1);
    expect(events.find(e => e.type === 'payment_refund_requested').payload).toMatchObject({ paymentId: 'payment-1', amountMinor: 10000, currency: 'RUB' });
    await run(); expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toContain('/reservations/reservation-1/consume'); expect(attempt.reservationId).toBe('reservation-1');
  });
  it('late failure cannot overwrite a newer worker claim', async () => {
    const first = await claimCrmDelivery(order.id); event().lockedAt = new Date(0); jest.advanceTimersByTime(61000);
    const second = await claimCrmDelivery(order.id); expect(second).not.toBeNull(); const current = copy(event());
    expect(await finishCrmDeliveryFailure(first!.claim, failure(500))).toBe(false);
    expect(event()).toEqual(current); expect(order.status).toBe('paid');
  });
  it('late success cannot project order or complete newer worker event', async () => {
    let replacement: any;
    http.post.mockImplementationOnce(async () => {
      event().lockedAt = new Date(0); jest.advanceTimersByTime(61000); replacement = await claimCrmDelivery(order.id); return success() as any;
    });
    await run();
    expect(replacement).not.toBeNull(); expect(order).toMatchObject({ crmOrderId: null, status: 'paid', crmStatusVersion: 0 });
    expect(event()).toMatchObject({ status: 'processing', attempts: replacement.claim.attempts, lockedAt: replacement.claim.lockedAt, processedAt: null });
  });
  it('does not spend HTTP budget after losing claim before HTTP admission', async () => {
    const first = await claimCrmDelivery(order.id);
    expect(event().attempts).toBe(0);
    jest.advanceTimersByTime(61000);
    const second = await claimCrmDelivery(order.id);
    expect(second).not.toBeNull();
    expect(await beginCrmDeliveryHttpAttempt(first!.claim)).toBeNull();
    expect(event().attempts).toBe(0); expect(http.post).not.toHaveBeenCalled();
    expect(await beginCrmDeliveryHttpAttempt(second!.claim)).toMatchObject({ attempts: 1 });
  });
  it('honors Retry-After HTTP dates/seconds, bounded at 300 seconds', () => {
    const now = Date.UTC(2026, 8, 25);
    expect(classifyCrmDeliveryError(failure(429, undefined, '120'), now).retryAfterMs).toBe(120000);
    expect(classifyCrmDeliveryError(failure(429, undefined, new Date(now + 45000).toUTCString()), now).retryAfterMs).toBe(45000);
    expect(classifyCrmDeliveryError(failure(429, undefined, '9999'), now).retryAfterMs).toBe(300000);
    expect(classifyCrmDeliveryError(failure(429, undefined, 'invalid'), now).retryAfterMs).toBe(0);
  });
});


