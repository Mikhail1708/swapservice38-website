import { PrismaClient } from '@prisma/client';
import { getPaymentStatus, handlePaymentWebhook } from '../../../src/services/payment.service';
import {
  dispatchPaymentProviderReconciliationEvent as dispatch,
  ensurePaymentProviderReconciliationEvent as ensure,
  scanPaymentProviderReconciliationAttempts as scan,
  PAYMENT_PROVIDER_RECONCILIATION_EVENT_TYPE as type,
  PAYMENT_PROVIDER_RECONCILIATION_MAX_ATTEMPTS as maxAttempts,
} from '../../../src/services/paymentProviderReconciliation.service';

jest.mock('../../../src/services/payment.service', () => ({
  getPaymentProvider: jest.fn(() => 'yookassa'),
  getPaymentStatus: jest.fn(), handlePaymentWebhook: jest.fn(),
}));
const db = new PrismaClient() as any;
const read = getPaymentStatus as jest.Mock;
const handle = handlePaymentWebhook as jest.Mock;
let event: any;
let attempt: any;
let payment: any;
const copy = (v: any) => structuredClone(v);
const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: any) => {
  if (value instanceof Date) return row[key]?.getTime() === value.getTime();
  if (value && typeof value === 'object') {
    if ('lte' in value) return row[key] <= value.lte;
    if ('lt' in value) return row[key] < value.lt;
    if ('gte' in value) return row[key] >= value.gte;
  }
  return row[key] === value;
});
beforeEach(() => {
  jest.clearAllMocks();
  attempt = { id: 'attempt', orderId: 'order', provider: 'yookassa', providerPaymentId: 'payment',
    reservationId: 'reservation', status: 'pending', amountMinor: 10000, currency: 'RUB',
    order: { id: 'order', paymentId: 'payment', total: 100, status: 'pending' } };
  payment = { id: 'payment', status: 'succeeded', amount: { value: '100.00', currency: 'RUB' },
    metadata: { orderId: 'order', reservationId: 'reservation' } };
  event = { id: 'event', aggregateId: 'order', type, status: 'pending', processedAt: null,
    attempts: 0, lockedAt: null, lastError: null, nextAttemptAt: new Date(0),
    payload: { orderId: 'order', attemptId: 'attempt', paymentId: 'payment' } };
  db.outboxEvent.updateMany.mockImplementation(async ({ where, data }: any) => {
    if (!matches(event, where)) return { count: 0 };
    Object.assign(event, { ...data, ...(data.attempts ? { attempts: event.attempts + data.attempts.increment } : {}) });
    return { count: 1 };
  });
  db.outboxEvent.findUnique.mockImplementation(async () => copy(event));
  db.outboxEvent.upsert.mockImplementation(async () => copy(event));
  db.paymentAttempt.findUnique.mockImplementation(async () => copy(attempt));
  db.paymentAttempt.updateMany.mockImplementation(async ({ data }: any) => { Object.assign(attempt, data); return { count: 1 }; });
  db.paymentAttempt.findMany.mockResolvedValue([]);
  db.order.updateMany.mockImplementation(async ({ where, data }: any) => {
    if (!matches(attempt.order, where)) return { count: 0 };
    Object.assign(attempt.order, data); return { count: 1 };
  });
  db.$transaction.mockImplementation(async (run: any) => run(db));
  db.$queryRaw.mockResolvedValue([]);
  read.mockImplementation(async () => copy(payment));
  handle.mockImplementation(async () => { attempt.status = payment.status; attempt.order.status = 'paid'; return { success: true }; });
});

it.each(['pending', 'initiating', 'unknown', 'succeeded'])('recovers %s through the existing handler using the immutable ID', async status => {
  attempt.status = status;
  expect(await dispatch('event')).toBe(true);
  expect(read).toHaveBeenCalledWith('payment');
  expect(handle).toHaveBeenCalledWith({ event: 'payment.succeeded', object: payment });
  expect(event.status).toBe('completed');
});

it('repairs missing order binding without changing the attempt provider ID', async () => {
  attempt.order.paymentId = null;
  await dispatch('event');
  expect(attempt.order.paymentId).toBe('payment');
  expect(attempt.providerPaymentId).toBe('payment');
});

it('polls pending again after backoff and stops at the bounded budget', async () => {
  payment.status = 'pending';
  expect(await dispatch('event')).toBe(false);
  expect(event.status).toBe('pending');
  expect(event.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  expect(await dispatch('event')).toBe(false);
  expect(read).toHaveBeenCalledTimes(1);
  event.nextAttemptAt = new Date(0); event.attempts = maxAttempts - 1;
  await dispatch('event');
  expect(event.status).toBe('failed');
  expect(event.attempts).toBe(maxAttempts);
  await ensure(db, attempt);
  expect(db.outboxEvent.upsert.mock.calls[0][0].update).toEqual({});
  expect(handle).not.toHaveBeenCalled();
});

it('retries provider errors without creating or handling a payment', async () => {
  read.mockRejectedValueOnce(new Error('provider timeout'));
  expect(await dispatch('event')).toBe(false);
  expect(event.lastError).toBe('PROVIDER_RECONCILIATION_LOOKUP_OR_HANDLER_FAILED');
  expect(handle).not.toHaveBeenCalled();
});

it('fails exhausted pending work without a provider request', async () => {
  event.attempts = maxAttempts;
  expect(await dispatch('event')).toBe(false);
  expect(event.status).toBe('failed');
  expect(read).not.toHaveBeenCalled();
});

it('stops on authentication failures without persisting provider diagnostics', async () => {
  read.mockRejectedValueOnce(Object.assign(new Error('secret token in request'), { response: { status: 401 } }));
  await dispatch('event');
  expect(event.status).toBe('failed');
  expect(event.lastError).toBe('PROVIDER_RECONCILIATION_AUTH_FAILED');
});

it('does not let recovery acquire a missing reservation through the legacy handler', async () => {
  attempt.reservationId = null;
  await dispatch('event');
  expect(event.status).toBe('failed');
  expect(handle).not.toHaveBeenCalled();
});

it('rechecks durable status after provider I/O to avoid overwriting a concurrent refund', async () => {
  read.mockImplementationOnce(async () => { attempt.status = 'refunded'; return copy(payment); });
  expect(await dispatch('event')).toBe(true);
  expect(attempt.status).toBe('refunded');
  expect(handle).not.toHaveBeenCalled();
});

it.each(['id', 'order', 'amount', 'currency', 'reservation', 'malformed'])('rejects mismatched %s before handling', async field => {
  if (field === 'id') payment.id = 'other';
  if (field === 'order') payment.metadata.orderId = 'other';
  if (field === 'amount') payment.amount.value = '101.00';
  if (field === 'currency') payment.amount.currency = 'USD';
  if (field === 'reservation') payment.metadata.reservationId = 'other';
  if (field === 'malformed') payment.amount.value = '1e2';
  expect(await dispatch('event')).toBe(false);
  expect(handle).not.toHaveBeenCalled();
  expect(event.status).toBe('failed');
});

it('dispatches canceled through the existing handler', async () => {
  payment.status = 'canceled';
  expect(await dispatch('event')).toBe(true);
  expect(handle).toHaveBeenCalledWith({ event: 'payment.canceled', object: payment });
});

it('concurrent dispatchers claim once and completed replay does not invoke the handler', async () => {
  await Promise.all([dispatch('event'), dispatch('event')]);
  await dispatch('event');
  expect(read).toHaveBeenCalledTimes(1);
  expect(handle).toHaveBeenCalledTimes(1);
});

it('does not let a stale lease overwrite a replacement claim', async () => {
  read.mockImplementationOnce(async () => {
    event.attempts++; event.lockedAt = new Date(Date.now() + 1000);
    throw new Error('old request failed');
  });
  await dispatch('event');
  expect(event.status).toBe('processing');
  expect(event.lastError).toBeNull();
});

it('does not touch an already refunded payment or completed success', async () => {
  attempt.status = 'refunded';
  await dispatch('event');
  expect(read).not.toHaveBeenCalled();
  expect(handle).not.toHaveBeenCalled();
});

it('scans bounded pages with a cursor and keeps terminal event budgets immutable', async () => {
  db.paymentAttempt.findMany.mockResolvedValueOnce([attempt]).mockResolvedValueOnce([]);
  await scan(1); await scan(1);
  expect(db.paymentAttempt.findMany.mock.calls[0][0].take).toBe(1);
  expect(db.paymentAttempt.findMany.mock.calls[1][0].where.id).toEqual({ gt: 'attempt' });
  expect(db.outboxEvent.upsert.mock.calls[0][0]).toMatchObject({
    where: { deduplicationKey: 'payment-provider-reconciliation:attempt:payment' }, update: {},
  });
});

it('does not apply a stale successful lookup after a newer dispatcher acquired the lease', async () => {
  attempt.order.paymentId = null;
  read.mockImplementationOnce(async () => {
    event.attempts++; event.lockedAt = new Date(Date.now() + 1000);
    return copy(payment);
  });
  await dispatch('event');
  expect(event.status).toBe('processing');
  expect(attempt.order.paymentId).toBeNull();
  expect(handle).not.toHaveBeenCalled();
});

it('does not perform provider I/O if the claim was replaced before reading it', async () => {
  db.outboxEvent.findUnique.mockImplementationOnce(async () => {
    event.attempts++; event.lockedAt = new Date(Date.now() + 1000);
    return copy(event);
  });
  expect(await dispatch('event')).toBe(false);
  expect(read).not.toHaveBeenCalled();
  expect(handle).not.toHaveBeenCalled();
  expect(event.status).toBe('processing');
});
