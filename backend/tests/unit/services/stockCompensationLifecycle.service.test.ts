import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { requestOrderCancellation } from '../../../src/services/orderCancellation.service';
import { handlePaymentSuccess, handlePaymentWebhook } from '../../../src/services/payment.service';
import { dispatchPaymentRefundEvent, dispatchReservationReleaseEvent } from '../../../src/services/crmOutbox.service';
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
    http.post.mockReset().mockResolvedValue({ data: { status: 'succeeded', id: 'refund-1' } });
  });
  afterAll(() => { process.env = savedEnv; });

  const cancel = () => requestOrderCancellation('order-1', 'user-1', 'customer_request');
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
