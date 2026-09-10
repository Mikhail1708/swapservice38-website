import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { createPayment, resetMockPaymentsForTests } from '../../../src/services/payment.service';

const originalTimeout = process.env.PAYMENT_HTTP_TIMEOUT_MS;
afterEach(() => {
  if (originalTimeout === undefined) delete process.env.PAYMENT_HTTP_TIMEOUT_MS;
  else process.env.PAYMENT_HTTP_TIMEOUT_MS = originalTimeout;
});

jest.mock('../../../src/services/email.service', () => ({
  sendOrderConfirmationToCustomer: jest.fn(), sendOrderNotificationToManager: jest.fn(),
}));
jest.mock('../../../src/services/crmOutbox.service', () => ({}));

const db = new PrismaClient() as any;
const http = axios as jest.Mocked<typeof axios>;
let orders: Map<string, any>;
let attempts: Map<string, any>;
let reservations: Map<string, any>;
let payments: Map<string, any>;
let stock: number;
let stockReads: number;
let ambiguousReservation: boolean;
const url = 'https://site.test/payment/success';
const clone = (value: any) => value == null ? value : structuredClone(value);

beforeEach(() => {
  jest.clearAllMocks(); resetMockPaymentsForTests();
  process.env.PAYMENT_PROVIDER = 'yookassa';
  orders = new Map(['one', 'two'].map(id => [id, { id, status: 'pending', cancellationState: 'none',
    total: 100, items: [{ productId: '1', name: 'Last unit', quantity: 1, price: 100 }], paymentId: null }]));
  attempts = new Map(); reservations = new Map(); payments = new Map(); stock = 1; stockReads = 0; ambiguousReservation = false;
  db.order.findUnique.mockImplementation(async ({ where }: any) => clone(orders.get(where.id)));
  db.order.update.mockImplementation(async ({ where, data }: any) => Object.assign(orders.get(where.id), data));
  db.paymentAttempt.findUnique.mockImplementation(async ({ where }: any) => clone(attempts.get(where.orderId) || [...attempts.values()].find(a => a.id === where.id)) || null);
  db.paymentAttempt.create.mockImplementation(async ({ data }: any) => {
    if (attempts.has(data.orderId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
    const attempt = { id: `attempt-${data.orderId}`, reservationId: null, providerPaymentId: null, ...data };
    attempts.set(data.orderId, attempt); return clone(attempt);
  });
  db.paymentAttempt.update.mockImplementation(async ({ where, data }: any) => {
    const attempt = [...attempts.values()].find(a => a.id === where.id)!; Object.assign(attempt, data); return clone(attempt);
  });
  // Model the existing database workflow lock; never open a real connection.
  let tail = Promise.resolve();
  db.$transaction.mockImplementation((run: Function) => {
    const next = tail.then(() => run(db)); tail = next.then(() => undefined, () => undefined); return next;
  });
  db.$queryRaw.mockResolvedValue([]);
  http.get.mockImplementation(async (address: any) => {
    if (address.includes('/api/public/products/')) {
      stockReads++; return { data: { id: 1, name: 'Last unit', retail_price: 100, stock, availableStock: stock } };
    }
    const payment = [...payments.values()].find(p => address.endsWith('/' + p.id));
    if (!payment) throw new Error('Unexpected provider lookup');
    return { data: clone(payment) };
  });
  http.post.mockImplementation(async (address: any, data: any, config: any) => {
    if (address.endsWith('/internal/v1/reservations')) {
      if (!reservations.has(data.externalOrderId)) {
        if (!stock) throw { response: { status: 409, data: { code: 'INSUFFICIENT_STOCK' } } };
        stock--;
        reservations.set(data.externalOrderId, { reservationId: `res-${data.externalOrderId}`, status: 'active',
          currency: 'RUB', totalMinor: 10000, expiresAt: new Date(Date.now() + 600000).toISOString(),
          items: [{ productId: 1, quantity: 1, unitPriceMinor: 10000 }] });
      }
      if (ambiguousReservation) { ambiguousReservation = false; throw new Error('CRM response lost'); }
      return { data: clone(reservations.get(data.externalOrderId)) };
    }
    if (!address.endsWith('/payments')) throw new Error('Unexpected network operation');
    const key = config.headers['Idempotence-Key'];
    if (!payments.has(key)) payments.set(key, { id: `provider-${payments.size + 1}`, status: 'pending',
      amount: data.amount, metadata: data.metadata, confirmation: { confirmation_url: 'https://provider.test/pay' } });
    return { data: clone(payments.get(key)) };
  });
});

it('last unit first payment succeeds; refresh and double click reuse it without stock reads or POSTs', async () => {
  const first = await createPayment('one', url);
  expect(stock).toBe(0); expect(first.status).toBe('pending');
  const postCount = http.post.mock.calls.length;
  for (let i = 0; i < 2; i++) expect(await createPayment('one', url)).toMatchObject({ paymentId: first.paymentId, idempotent: true });
  expect(stockReads).toBe(1); expect(http.post).toHaveBeenCalledTimes(postCount);
  expect(attempts.size).toBe(1); expect(reservations.size).toBe(1); expect(payments.size).toBe(1);
  expect(db.outboxEvent.upsert).not.toHaveBeenCalled();
});

it('concurrent same-order calls share attempt, reservation, provider key and payment ID', async () => {
  const results = await Promise.all([createPayment('one', url), createPayment('one', url)]);
  expect(results[0].paymentId).toBe(results[1].paymentId);
  expect(stockReads).toBe(1); expect(stock).toBe(0);
  expect(attempts.size).toBe(1); expect(reservations.size).toBe(1); expect(payments.size).toBe(1);
  expect(new Set(http.post.mock.calls.filter(([u]) => u.endsWith('/payments')).map(([, , c]) => c!.headers!['Idempotence-Key'])).size).toBe(1);
});

it('concurrent mock provider uses the same per-attempt payment identity', async () => {
  process.env.PAYMENT_PROVIDER = 'mock';
  const results = await Promise.all([createPayment('one', url), createPayment('one', url)]);
  expect(results[0].paymentId).toBe(results[1].paymentId);
  expect(attempts.size).toBe(1); expect(reservations.size).toBe(1); expect(payments.size).toBe(0);
});

it('different order cannot buy the unit reserved by the first order', async () => {
  await createPayment('one', url);
  await expect(createPayment('two', url)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  expect(attempts.has('two')).toBe(false); expect(reservations.size).toBe(1); expect(payments.size).toBe(1);
});

it.each(['zero stock', 'on-order product'])('%s without an owned reservation cannot be paid', async () => {
  stock = 0;
  await expect(createPayment('one', url)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  expect(attempts.size).toBe(0); expect(http.post).not.toHaveBeenCalled();
});

it('recovers a CRM committed reservation after lost response without checking free stock', async () => {
  ambiguousReservation = true;
  await expect(createPayment('one', url)).rejects.toMatchObject({ code: 'RESERVATION_FAILED' });
  expect(stock).toBe(0); expect(attempts.get('one').reservationId).toBeNull();
  expect((await createPayment('one', url)).status).toBe('pending');
  expect(stockReads).toBe(1); expect(reservations.size).toBe(1); expect(payments.size).toBe(1);
});

it('recovers attempt-bound provider identity when order binding was interrupted', async () => {
  const first = await createPayment('one', url); orders.get('one').paymentId = null;
  const calls = http.post.mock.calls.length;
  expect(await createPayment('one', url)).toMatchObject({ paymentId: first.paymentId, idempotent: true });
  expect(http.post).toHaveBeenCalledTimes(calls); expect(stockReads).toBe(1);
});

it('expired reservation rejects new provider initiation and pending retry without reallocating stock', async () => {
  await createPayment('one', url); attempts.get('one').reservationExpiresAt = new Date(0);
  const calls = http.post.mock.calls.length;
  await expect(createPayment('one', url)).rejects.toMatchObject({ code: 'RESERVATION_EXPIRED' });
  orders.get('one').paymentId = null; attempts.get('one').providerPaymentId = null;
  await expect(createPayment('one', url)).rejects.toMatchObject({ code: 'RESERVATION_EXPIRED' });
  expect(http.post).toHaveBeenCalledTimes(calls); expect(reservations.size).toBe(1);
});

it('succeeded provider payment can be recovered after reservation expiry without creating anything', async () => {
  const first = await createPayment('one', url);
  [...payments.values()][0].status = 'succeeded'; attempts.get('one').reservationExpiresAt = new Date(0);
  orders.get('one').paymentId = null;
  const calls = http.post.mock.calls.length;
  expect(await createPayment('one', url)).toMatchObject({ paymentId: first.paymentId, status: 'succeeded' });
  expect(http.post).toHaveBeenCalledTimes(calls); expect(stockReads).toBe(1);
});

it('a provider timeout retries the same idempotency key instead of creating another payment', async () => {
  const normalPost = http.post.getMockImplementation()!;
  let loseResponse = true;
  http.post.mockImplementation(async (...args: any[]) => {
    const result = await (normalPost as any)(...args);
    if (args[0].endsWith('/payments') && loseResponse) { loseResponse = false; throw new Error('Provider response lost'); }
    return result;
  });
  await expect(createPayment('one', url)).rejects.toThrow();
  expect((await createPayment('one', url)).status).toBe('pending');
  expect(stockReads).toBe(1); expect(payments.size).toBe(1); expect(reservations.size).toBe(1);
});

it('F19 create, status and attempt recovery use configured finite timeout', async () => {
  process.env.PAYMENT_HTTP_TIMEOUT_MS = '4321';
  const first = await createPayment('one', url);
  await createPayment('one', url);
  orders.get('one').paymentId = null;
  expect(await createPayment('one', url)).toMatchObject({ paymentId: first.paymentId, idempotent: true });
  const posts = http.post.mock.calls.filter(([address]) => address.endsWith('/payments'));
  const gets = http.get.mock.calls.filter(([address]) => address.includes('api.yookassa.ru'));
  expect(posts).toHaveLength(1); expect(gets).toHaveLength(2);
  for (const [, , config] of posts) expect(config.timeout).toBe(4321);
  for (const [, config] of gets) expect(config.timeout).toBe(4321);
});

it.each(['ECONNABORTED', 'ETIMEDOUT'])('F19 ambiguous %s preserves attempt, reservation and provider idempotency on retry', async code => {
  process.env.PAYMENT_HTTP_TIMEOUT_MS = '9876';
  const normalPost = http.post.getMockImplementation()!;
  let loseResponse = true;
  http.post.mockImplementation(async (...args: any[]) => {
    const result = await (normalPost as any)(...args);
    if (args[0].endsWith('/payments') && loseResponse) {
      loseResponse = false; throw Object.assign(new Error('timeout of 9876ms exceeded'), { code, isAxiosError: true });
    }
    return result;
  });
  await expect(createPayment('one', url)).rejects.toThrow('Ошибка создания платежа');
  expect(attempts.get('one').status).toBe('unknown');
  const originalAttempt = clone(attempts.get('one'));
  expect(http.post.mock.calls.filter(([address]) => address.endsWith('/payments'))).toHaveLength(1);
  expect((await createPayment('one', url)).status).toBe('pending');
  const calls = http.post.mock.calls.filter(([address]) => address.endsWith('/payments'));
  expect(calls).toHaveLength(2);
  for (const [, , config] of calls) {
    expect(config.timeout).toBe(9876);
    expect(config.headers['Idempotence-Key']).toBe(originalAttempt.idempotencyKey);
  }
  expect(attempts.size).toBe(1); expect(reservations.size).toBe(1); expect(payments.size).toBe(1);
  expect(attempts.get('one').id).toBe(originalAttempt.id);
});
