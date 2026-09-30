import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { requestOrderCancellation } from '../../../src/services/orderCancellation.service';
import { handlePaymentSuccess, handlePaymentWebhook } from '../../../src/services/payment.service';
import { dispatchPaymentRefundEvent, dispatchReservationReleaseEvent, replayFailedPaymentRefund } from '../../../src/services/crmOutbox.service';
import { handleOrderStatusWebhook } from '../../../src/controllers/webhook.controller';

jest.mock('axios');
jest.mock('../../../src/queues/crm.queue', () => ({ addOrderToCRMQueue: jest.fn() }));
jest.mock('../../../src/services/email.service', () => ({ sendOrderStatusUpdateToCustomer: jest.fn() }));

const db = new PrismaClient() as any;
const http = axios as jest.Mocked<typeof axios>;
const copy = (value: any): any => structuredClone(value);

// Model the shared Order lock and Prisma CAS predicates. This exercises real
// services, but deliberately makes no claim about PostgreSQL lock execution.
const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: any) => {
  if (key === 'OR') return value.some((part: any) => matches(row, part));
  if (value instanceof Date) return row[key] instanceof Date && row[key].getTime() === value.getTime();
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('in' in value) return value.in.includes(row[key]);
    if ('notIn' in value) return !value.notIn.includes(row[key]);
    if ('lte' in value) return row[key] <= value.lte;
  }
  return row[key] === value;
});
const apply = (row: any, data: any) => {
  for (const [key, value] of Object.entries(data) as any) {
    row[key] = value && typeof value === 'object' && 'increment' in value
      ? row[key] + value.increment : value;
  }
};

describe('F07 SITE compensation lifecycle with durable in-memory state', () => {
  let order: any;
  let attempt: any;
  let events: any[];
  let tail: Promise<any>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYMENT_PROVIDER = 'yookassa';
    process.env.YOO_KASSA_SHOP_ID = 'test-shop';
    process.env.YOO_KASSA_SECRET_KEY = 'test-secret';
    process.env.INTERNAL_API_KEY = 'test-internal-key';
    process.env.WEBHOOK_SECRET = 'test-webhook-secret';
    order = { id: 'order-1', userId: 'user-1', status: 'pending', crmOrderId: null,
      cancellationState: 'none', createdAt: new Date(), crmStatusVersion: 0 };
    attempt = { id: 'attempt-1', orderId: order.id, status: 'pending',
      providerPaymentId: 'payment-1', reservationId: 'reservation-1', amountMinor: 10000, currency: 'RUB' };
    events = [];
    tail = Promise.resolve();
    db.$transaction.mockImplementation((callback: any) => {
      const result = tail.then(async () => {
        const snapshot = copy({ order, attempt, events });
        try { return await callback(db); }
        catch (error) { ({ order, attempt, events } = snapshot); throw error; }
      });
      tail = result.catch(() => undefined);
      return result;
    });
    db.$queryRaw.mockResolvedValue([]);
    db.order.findUnique.mockImplementation(async () => copy({ ...order, paymentAttempts: [attempt] }));
    db.order.findFirst.mockImplementation(async () => copy(order));
    db.order.update.mockImplementation(async ({ data }: any) => { apply(order, data); return copy(order); });
    db.paymentAttempt.findUnique.mockImplementation(async () => copy(attempt));
    db.paymentAttempt.update.mockImplementation(async ({ data }: any) => { apply(attempt, data); return copy(attempt); });
    db.paymentAttempt.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (!matches(attempt, where)) return { count: 0 };
      apply(attempt, data); return { count: 1 };
    });
    db.outboxEvent.findFirst.mockImplementation(async ({ where }: any) => copy(events.find(row => matches(row, where)) || null));
    db.outboxEvent.findUnique.mockImplementation(async ({ where }: any) => copy(events.find(row => matches(row, where)) || null));
    db.outboxEvent.upsert.mockImplementation(async ({ where, create, update }: any) => {
      let row = events.find(event => matches(event, where));
      if (row) apply(row, update);
      else { row = { id: `event-${events.length + 1}`, status: 'pending', attempts: 0,
        nextAttemptAt: new Date(0), processedAt: null, ...copy(create) }; events.push(row); }
      return copy(row);
    });
    db.outboxEvent.updateMany.mockImplementation(async ({ where, data }: any) => {
      const rows = events.filter(row => matches(row, where));
      rows.forEach(row => apply(row, data)); return { count: rows.length };
    });
    db.outboxEvent.update.mockImplementation(async ({ where, data }: any) => {
      const row = events.find(row => matches(row, where));
      apply(row, data); return copy(row);
    });
    http.get.mockReset().mockResolvedValue({ data: { id: 'payment-1', status: 'succeeded', paid: true, refundable: true,
      amount: { value: '100.00', currency: 'RUB' }, refunded_amount: { value: '0.00', currency: 'RUB' } } });
    http.post.mockReset().mockResolvedValue({ data: { status: 'succeeded', id: 'refund-1', payment_id: 'payment-1', amount: { value: '100.00', currency: 'RUB' } } });
  });
  afterAll(() => { process.env = savedEnv; });

  const cancel = () => requestOrderCancellation('order-1', 'user-1', 'customer_request');
  const payment = (refundable: boolean, refunded = '0.00') => ({ data: { id: 'payment-1', status: 'succeeded', paid: true,
    refundable, amount: { value: '100.00', currency: 'RUB' }, refunded_amount: { value: refunded, currency: 'RUB' } } });
  const refundIntent = async () => {
    order.crmOrderId = '42'; order.status = 'confirmed'; attempt.status = 'succeeded';
    await callback();
    return events.find(row => row.type === 'payment_refund_requested');
  };
  const callback = async (status = 'cancelled', version = 1, valid = true) => {
    const payload = { crmOrderId: '42', status, version };
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
    const signature = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET!).update(canonical).digest('hex');
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await handleOrderStatusWebhook({ body: payload, headers: { 'x-webhook-signature': valid ? signature : 'bad' } } as any, res);
    return res;
  };

  it('concurrent and repeated active cancellation creates one release and dispatches it once', async () => {
    await Promise.all([cancel(), cancel()]); await cancel();
    expect(events).toHaveLength(1);
    expect(events[0].deduplicationKey).toBe('crm-reservation-release:reservation-1');
    const result = await Promise.all([dispatchReservationReleaseEvent(events[0].id), dispatchReservationReleaseEvent(events[0].id)]);
    expect(result.sort()).toEqual([false, true]);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(order.status).toBe('cancelled'); expect(attempt.status).toBe('pending');
  });

  it('duplicate canceled payment signals and manual cancellation share one release', async () => {
    const signal = () => handlePaymentWebhook({ object: { status: 'canceled', metadata: { orderId: order.id } } });
    await Promise.all([cancel(), signal(), signal()]);
    expect(events).toHaveLength(1); expect(attempt.status).toBe('canceled');
    expect(events[0].type).toBe('crm_reservation_release_requested');
  });

  it('late concurrent payment success and cancellation retry converge to one refund and release', async () => {
    await cancel();
    await Promise.all([cancel(), handlePaymentSuccess(order.id), handlePaymentSuccess(order.id)]);
    expect(order.status).toBe('cancelled'); expect(attempt.status).toBe('refunded');
    expect(events.map(row => row.type).sort()).toEqual(['crm_reservation_release_requested', 'payment_refund_requested']);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('authoritative consumed-order cancellation creates one refund and never ordinary release', async () => {
    order.crmOrderId = '42'; order.status = 'confirmed'; attempt.status = 'succeeded';
    await cancel();
    await Promise.all([callback(), callback()]);
    const refund = events.find(row => row.type === 'payment_refund_requested');
    expect(refund).toBeDefined();
    await Promise.all([dispatchPaymentRefundEvent(refund.id), dispatchPaymentRefundEvent(refund.id), callback()]);
    await callback();
    expect(attempt.status).toBe('refunded');
    expect(events.filter(row => row.type === 'payment_refund_requested')).toHaveLength(1);
    expect(events.some(row => row.type === 'crm_reservation_release_requested')).toBe(false);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('provider timeout retries the same refund identity without a stock-release event', async () => {
    order.crmOrderId = '42'; order.status = 'confirmed'; attempt.status = 'succeeded';
    await callback();
    const refund = events[0];
    http.post.mockRejectedValueOnce(new Error('response lost'));
    expect(await dispatchPaymentRefundEvent(refund.id)).toBe(false);
    refund.nextAttemptAt = new Date(0);
    expect(await dispatchPaymentRefundEvent(refund.id)).toBe(true);
    expect(http.post.mock.calls.map(call => call[2]?.headers?.['Idempotence-Key'])).toEqual([
      'payment-refund:payment-1', 'payment-refund:payment-1',
    ]);
    expect(events).toHaveLength(1); expect(attempt.status).toBe('refunded');
  });

  it('waits durably beyond eight non-refundable checks, then completes the same intent exactly once', async () => {
    const event = await refundIntent();
    http.get.mockResolvedValue(payment(false));
    for (let i = 0; i < 10; i++) {
      event.nextAttemptAt = new Date(0);
      expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
      expect(attempt.status).toBe('refund_required');
      expect(event.status).toBe('pending'); expect(event.processedAt).toBeNull();
      expect(event.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(Date.now() + 299000);
      expect(await dispatchPaymentRefundEvent(event.id)).toBe(false); // Immediate retry cannot claim.
    }
    expect(http.post).not.toHaveBeenCalled();
    expect(event.attempts).toBe(0);
    http.get.mockResolvedValue(payment(true)); event.nextAttemptAt = new Date(0);
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1); expect(event.status).toBe('completed');
    expect(attempt).toMatchObject({ status: 'refunded', refundId: 'refund-1', lastError: null });
    expect(attempt.refundedAt).toBeInstanceOf(Date);
  });

  it.each([undefined, 500, 503, 429])('GET failure %s remains retryable without POST', async status => {
    const event = await refundIntent();
    http.get.mockRejectedValueOnce(Object.assign(new Error('timeout with SECRET'), { response: status ? { status } : undefined }));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(event.status).toBe('pending'); expect(attempt.status).toBe('refund_required');
    expect(event.lastError).not.toContain('SECRET'); expect(http.post).not.toHaveBeenCalled();
    expect(event.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('terminal rejection fails once with safe provider diagnostics', async () => {
    const event = await refundIntent();
    http.post.mockRejectedValueOnce({ response: { status: 400, data: { code: 'invalid_request', parameter: 'amount.value',
      description: 'SECRET buyer@example.com credentials' } } });
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(event.status).toBe('failed'); expect(attempt.status).toBe('refund_failed');
    expect(JSON.parse(event.lastError)).toMatchObject({ httpStatus: 400, code: 'invalid_request', parameter: 'amount.value' });
    expect(event.lastError).not.toMatch(/SECRET|buyer@example/);
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false); expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('provider aggregate full refund reconciles without a new POST or invented refund ID', async () => {
    const event = await refundIntent();
    http.get.mockResolvedValue(payment(false, '100.00'));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
    expect(attempt.status).toBe('refunded'); expect(attempt.refundId).toBeNull();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('pending provider refund persists identity and polls it without another POST', async () => {
    const event = await refundIntent();
    const providerRefund = { id: 'refund-1', payment_id: 'payment-1', status: 'pending', amount: { value: '100.00', currency: 'RUB' } };
    http.post.mockResolvedValueOnce({ data: providerRefund });
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(attempt.refundId).toBe('refund-1'); expect(attempt.status).toBe('refund_required');
    event.nextAttemptAt = new Date(0);
    http.get.mockImplementation(async url => String(url).includes('/refunds/')
      ? { data: { ...providerRefund, status: 'succeeded' } } : payment(false));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('refundable becoming false between GET and POST 403 defers instead of failing', async () => {
    const event = await refundIntent();
    http.get.mockResolvedValueOnce(payment(true)).mockResolvedValueOnce(payment(false));
    http.post.mockRejectedValueOnce({ response: { status: 403, data: { code: 'forbidden' } } });
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(event.status).toBe('pending'); expect(attempt.status).toBe('refund_required');
    expect(event.payload.refundPostStartedAt).toBeUndefined();
    event.nextAttemptAt = new Date(0);
    http.get.mockResolvedValue(payment(true));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
  });

  it('manual retry keeps the original clock/key and reconciles provider full refund after the window expires', async () => {
    const event = await refundIntent();
    event.payload.refundPostStartedAt = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(event.status).toBe('failed'); expect(event.lastError).toContain('REFUND_IDEMPOTENCY_WINDOW_EXPIRED');
    expect(http.post).not.toHaveBeenCalled();
    const started = event.payload.refundPostStartedAt;
    await replayFailedPaymentRefund(order.id);
    expect(event.payload.refundPostStartedAt).toBe(started);
    http.get.mockResolvedValue(payment(false, '100.00'));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
    expect(attempt.status).toBe('refunded'); expect(http.post).not.toHaveBeenCalled();
  });

  it('manual replay of a legacy failed intent conservatively preserves the earliest possible POST time', async () => {
    const event = await refundIntent();
    delete event.payload.refundWorkflowVersion;
    event.attempts = 8; event.status = 'failed'; event.createdAt = new Date(Date.now() - 25 * 3600000);
    attempt.status = 'refund_failed'; attempt.refundReason = 'post_handoff_cancellation';
    await replayFailedPaymentRefund(order.id);
    expect(event.payload.refundPostStartedAt).toBe(event.createdAt.toISOString());
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('POST 5xx retries with same admission marker and idempotency key', async () => {
    const event = await refundIntent();
    http.post.mockRejectedValueOnce({ response: { status: 503 } });
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    const started = event.payload.refundPostStartedAt;
    event.nextAttemptAt = new Date(0);
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(true);
    expect(event.payload.refundPostStartedAt).toBe(started);
    expect(http.post.mock.calls.map(call => call[2]?.headers?.['Idempotence-Key'])).toEqual([event.deduplicationKey, event.deduplicationKey]);
  });

  it('partial refund or mismatched provider amount never triggers a new refund', async () => {
    const event = await refundIntent();
    http.get.mockResolvedValue(payment(true, '50.00'));
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(event.status).toBe('failed'); expect(event.lastError).toContain('REFUND_PARTIAL_REQUIRES_REVIEW');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('a revoked worker lease cannot post or finalize refund', async () => {
    const event = await refundIntent();
    http.get.mockImplementationOnce(async () => { event.lockedAt = new Date(0); return payment(true); });
    expect(await dispatchPaymentRefundEvent(event.id)).toBe(false);
    expect(http.post).not.toHaveBeenCalled(); expect(attempt.status).toBe('refund_required');
  });

  it('invalid HMAC is rejected while authoritative post-shipment cancellation is applied', async () => {
    order.crmOrderId = '42'; order.status = 'shipped'; attempt.status = 'succeeded';
    expect((await callback('cancelled', 1, false)).status).toHaveBeenCalledWith(401);
    expect((await callback()).status).toHaveBeenCalledWith(200);
    expect(order.status).toBe('cancelled'); expect(attempt.status).toBe('refund_required');
    expect(events).toHaveLength(1); expect(events[0].type).toBe('payment_refund_requested');
  });

  it('successful non-refunded processing and stale callbacks never schedule release or refund', async () => {
    order.crmOrderId = '42'; order.status = 'confirmed'; attempt.status = 'succeeded';
    expect((await callback('assembling', 2)).status).toHaveBeenCalledWith(200);
    await callback('cancelled', 1);
    expect(order.status).toBe('assembling'); expect(attempt.status).toBe('succeeded');
    expect(events).toHaveLength(0); expect(http.post).not.toHaveBeenCalled();
  });
});
