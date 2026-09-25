// Real payment/controller/outbox handlers with a serialized, stateful DB fixture.
// This verifies business concurrency; it does not claim PostgreSQL integration.
jest.unmock('@services/email.service');
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { paymentWebhookController } from '../../../src/controllers/payment.controller';
import { getPaymentStatus, resendOrderToCRM } from '../../../src/services/payment.service';
import {
  dispatchPaymentProviderReconciliationEvent as dispatch,
  scanPaymentProviderReconciliationAttempts as scan,
  PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE as type,
} from '../../../src/services/paymentProviderReconciliation.service';

const db = new PrismaClient() as any;
const copy = (v: any) => structuredClone(v);
let order: any, attempt: any, events: any[], emails: any[], payment: any;
let transactions: Promise<any>;
const matches = (row: any, where: any): boolean => Object.entries(where || {}).every(([key, value]: any) => {
  if (value === undefined) return true;
  if (key === 'OR') return value.some((condition: any) => matches(row, condition));
  if (value instanceof Date) return row[key]?.getTime() === value.getTime();
  if (value && typeof value === 'object') {
    if ('in' in value && !value.in.includes(row[key])) return false;
    if ('notIn' in value && value.notIn.includes(row[key])) return false;
    if ('not' in value && row[key] === value.not) return false;
    if ('lte' in value && !(row[key] <= value.lte)) return false;
    if ('lt' in value && !(row[key] < value.lt)) return false;
    if ('gte' in value && !(row[key] >= value.gte)) return false;
    if ('gt' in value && !(row[key] > value.gt)) return false;
    return true;
  }
  return row[key] === value;
});
const change = (row: any, data: any) => {
  for (const [key, value] of Object.entries(data) as any) {
    row[key] = value && typeof value === 'object' && 'increment' in value
      ? row[key] + value.increment : copy(value);
  }
  row.updatedAt = new Date();
};
const updateMany = (rows: () => any[]) => async ({ where, data }: any) => {
  const selected = rows().filter(row => matches(row, where));
  selected.forEach(row => change(row, data)); return { count: selected.length };
};
const upsert = (rows: () => any[]) => async ({ where, create, update }: any) => {
  let row = rows().find(row => matches(row, where));
  if (row) change(row, update);
  else {
    row = { id: `event-${events.length + emails.length}`, status: 'pending', attempts: 0,
      processedAt: null, lockedAt: null, nextAttemptAt: new Date(0), lastError: null, ...copy(create) };
    rows().push(row);
  }
  return copy(row);
};
beforeEach(() => {
  jest.clearAllMocks();
  process.env.PAYMENT_PROVIDER = 'yookassa';
  order = { id: 'order-1', orderNumber: 'WEB-1', total: 100, status: 'pending',
    paymentId: 'payment-1', crmOrderId: null, cancellationState: 'none',
    customerFirstName: 'Test', customerEmail: 'customer@example.test', customerPhone: '79991234567',
    items: [{ productId: 1, name: 'Part', quantity: 2, price: 50 }], user: {} };
  attempt = { id: 'attempt-1', orderId: order.id, provider: 'yookassa', status: 'pending',
    providerPaymentId: 'payment-1', reservationId: 'reservation-1', amountMinor: 10000,
    currency: 'RUB', idempotencyKey: 'unchanged-key' };
  payment = { id: 'payment-1', status: 'succeeded', amount: { value: '100.00', currency: 'RUB' },
    metadata: { orderId: order.id, reservationId: 'reservation-1' } };
  events = []; emails = []; transactions = Promise.resolve();
  db.order.findUnique.mockImplementation(async () => copy({ ...order, paymentAttempts: [attempt] }));
  db.order.updateMany.mockImplementation(updateMany(() => [order]));
  db.paymentAttempt.findUnique.mockImplementation(async () => copy({ ...attempt, order }));
  db.paymentAttempt.findMany.mockImplementation(async () => attempt.status === 'pending' ? [copy(attempt)] : []);
  db.paymentAttempt.updateMany.mockImplementation(updateMany(() => [attempt]));
  db.paymentAttempt.update.mockImplementation(async ({ where, data }: any) => {
    if (!matches(attempt, where)) throw new Error('Fixture attempt missing');
    change(attempt, data); return copy(attempt);
  });
  db.outboxEvent.findUnique.mockImplementation(async ({ where }: any) => copy(events.find(e => matches(e, where)) || null));
  db.outboxEvent.upsert.mockImplementation(upsert(() => events));
  db.outboxEvent.updateMany.mockImplementation(updateMany(() => events));
  db.outboxEvent.update.mockImplementation(async ({ where, data }: any) => {
    const row = events.find(e => matches(e, where));
    if (!row) throw new Error('Fixture event missing');
    change(row, data); return copy(row);
  });
  db.emailOutboxEvent.upsert.mockImplementation(upsert(() => emails));
  db.$queryRaw.mockResolvedValue([]);
  db.$transaction.mockImplementation((run: any) => {
    const result = transactions.then(async () => {
      const snapshot = copy({ order, attempt, events, emails });
      try { return await run(db); }
      catch (error) { ({ order, attempt, events, emails } = snapshot); throw error; }
    });
    transactions = result.catch(() => undefined); return result;
  });
  (axios.get as jest.Mock).mockReset().mockImplementation(async () => ({ data: copy(payment) }));
  (axios.post as jest.Mock).mockReset();
});

it('recovers provider success after restart using GET and the real durable payment/email handlers', async () => {
  await scan();
  const recovery = events.find(e => e.type === type);
  expect(recovery).toBeDefined();
  expect(await dispatch(recovery.id)).toBe(true);
  expect(order.status).toBe('paid');
  expect(attempt.status).toBe('succeeded');
  const creates = events.filter(e => e.type === 'crm_order_create_requested');
  expect(creates).toHaveLength(1);
  expect(creates[0].payload.orderData).toMatchObject({ externalOrderId: order.id,
    paymentId: 'payment-1', reservationId: 'reservation-1', paidAmountMinor: 10000, currency: 'RUB', contractVersion: 1 });
  expect(emails.map(e => e.deduplicationKey).sort()).toEqual([
    'order:notified:customer:order-1', 'payment_succeeded:order-1:manager',
  ]);
  expect(emails.every(e => e.eventType === 'payment_succeeded')).toBe(true);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/payments\/payment-1$/), expect.any(Object));
  expect(axios.post).not.toHaveBeenCalled();
  expect(db.paymentAttempt.create).not.toHaveBeenCalled();
  expect(db.order.create).not.toHaveBeenCalled();
});

it('concurrent authoritative webhook and provider reconciliation commit one success and two recipient email events', async () => {
  await scan();
  const recovery = events.find(e => e.type === type);
  let release!: () => void;
  const bothLookups = new Promise<void>(resolve => { release = resolve; });
  let lookups = 0;
  (axios.get as jest.Mock).mockImplementation(async () => {
    if (++lookups === 2) release();
    await bothLookups; return { data: copy(payment) };
  });
  const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await Promise.all([
    dispatch(recovery.id),
    paymentWebhookController({ body: { event: 'payment.succeeded', object: { id: payment.id } } } as any, response),
  ]);
  expect(response.status).not.toHaveBeenCalled();
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  expect(order).toMatchObject({ status: 'paid', paymentId: 'payment-1', crmOrderId: null });
  expect(attempt).toMatchObject({ status: 'succeeded', providerPaymentId: 'payment-1',
    reservationId: 'reservation-1', idempotencyKey: 'unchanged-key' });
  expect(events.filter(e => e.type === 'crm_order_create_requested')).toHaveLength(1);
  expect(events.find(e => e.type === type).status).toBe('completed');
  expect(emails).toHaveLength(2);
  expect(new Set(emails.map(e => e.deduplicationKey)).size).toBe(2);
  await dispatch(recovery.id);
  await paymentWebhookController({ body: { object: { id: payment.id } } } as any, response);
  expect(emails).toHaveLength(2);
  expect(events.filter(e => e.type === 'crm_order_create_requested')).toHaveLength(1);
  expect(axios.post).not.toHaveBeenCalled();
  expect(db.paymentAttempt.create).not.toHaveBeenCalled();
  expect(db.order.create).not.toHaveBeenCalled();
});

it.each([401, 403])('preserves only HTTP %s classification through the actual provider adapter', async status => {
  (axios.get as jest.Mock).mockRejectedValue(Object.assign(new Error('secret provider body'), {
    response: { status, data: { private: 'secret body' } }, config: { auth: 'secret credentials' },
  }));
  await expect(getPaymentStatus('payment-1')).rejects.toMatchObject({ response: { status } });
  await scan();
  const recovery = events.find(e => e.type === type);
  await dispatch(recovery.id);
  expect(recovery.status).toBe('failed');
  expect(recovery.lastError).toBe('PROVIDER_RECONCILIATION_AUTH_FAILED');
  expect(emails).toHaveLength(0);
  expect(events.filter(e => e.type === 'crm_order_create_requested')).toHaveLength(0);
});

it('the existing explicit manual resend replays the original failed create even when reconciliation is failed', async () => {
  order.status = 'crm_failed'; attempt.status = 'succeeded';
  const immutable = { orderId: order.id, orderData: {
    contractVersion: 1, externalOrderId: order.id, paymentId: attempt.providerPaymentId,
    reservationId: attempt.reservationId, paidAmountMinor: attempt.amountMinor, currency: 'RUB',
    items: [{ productId: 1, quantity: 2, price: 50 }], client: { phone: '79991234567' },
  } };
  events.push({ id: 'crm-create', type: 'crm_order_create_requested', aggregateId: order.id,
    deduplicationKey: `crm-order-create:${order.id}`, status: 'failed', attempts: 8,
    payload: copy(immutable), processedAt: null, lockedAt: null, nextAttemptAt: new Date(0),
    lastError: 'CRM HTTP 503; exhausted' });
  events.push({ id: 'crm-reconcile', type: 'payment_reconciliation_required', aggregateId: order.id,
    deduplicationKey: `payment-reconciliation:${attempt.providerPaymentId}`, status: 'failed',
    attempts: 8, processedAt: null, lastError: 'Previous reconciliation failure' });
  expect(await resendOrderToCRM(order.id)).toMatchObject({ success: true, queued: true });
  const replayed = events.find(e => e.id === 'crm-create');
  expect(replayed.status).toBe('dispatched');
  expect(replayed.attempts).toBe(0);
  expect(replayed.payload.orderData).toEqual(immutable.orderData);
  expect(replayed.payload.previousDeliveryFailure).toMatchObject({ attempts: 8, lastError: 'CRM HTTP 503; exhausted' });
  expect(events.find(e => e.id === 'crm-reconcile').status).toBe('failed');
  expect(attempt).toMatchObject({ providerPaymentId: 'payment-1', reservationId: 'reservation-1', idempotencyKey: 'unchanged-key' });
  expect(axios.post).not.toHaveBeenCalled();
  expect(emails).toHaveLength(0);
});
