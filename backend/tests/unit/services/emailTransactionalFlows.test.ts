import { Request, Response } from 'express';
import crypto from 'crypto';
import Queue from 'bull';
import { PrismaClient } from '@prisma/client';
import { offerAcceptance } from '../../helpers/consent';
import { createOrderController } from '../../../src/controllers/order.controller';
import { handleOrderStatusWebhook } from '../../../src/controllers/webhook.controller';
import { handlePaymentSuccess } from '../../../src/services/payment.service';
import { validateCheckoutItems } from '../../../src/services/checkoutInventory.service';

jest.mock('../../../src/services/email.service', () => jest.requireActual('../../../src/services/email.service'));
jest.mock('../../../src/services/checkoutInventory.service', () => ({
  ...jest.requireActual('../../../src/services/checkoutInventory.service'),
  validateCheckoutItems: jest.fn(),
}));
jest.mock('../../../src/services/crmOutbox.service', () => ({
  ...jest.requireActual('../../../src/services/crmOutbox.service'),
  dispatchCrmOutboxEvent: jest.fn().mockResolvedValue(true),
}));

const prisma = new PrismaClient() as any;
const queues = (Queue as unknown as jest.Mock).mock.results.map(result => result.value);
const items = [{ productId: '1', name: 'Product', quantity: 1, price: 100 }];
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

// Actual controllers/services use a staged transaction client. A rejected callback
// discards order, cart, attempt and event changes; no real database is accessed.
describe('Business controller email atomicity (F20)', () => {
  let state: any;
  let failPersistence: boolean;
  const oldUrl = process.env.PUBLIC_APP_URL;
  const oldSecret = process.env.WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.PUBLIC_APP_URL = 'https://example.test';
    process.env.WEBHOOK_SECRET = 'f20-webhook-test';
  });
  afterAll(() => {
    if (oldUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = oldSecret;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    failPersistence = false;
    state = {
      order: null, cart: { id: 'cart-1', userId: 'user-1', items },
      emails: {}, crmEvents: {}, attempt: null,
    };
    prisma.userConsent.findUnique.mockResolvedValue({ id: 'consent-1' });
    prisma.cart.findUnique.mockImplementation(async () => state.cart);
    prisma.order.findUnique.mockImplementation(async () => state.order && ({ ...state.order, paymentAttempts: state.attempt ? [state.attempt] : [] }));
    prisma.order.findFirst.mockImplementation(async () => state.order);
    (validateCheckoutItems as jest.Mock).mockResolvedValue({ items, total: 100 });
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const staged = JSON.parse(JSON.stringify(state));
      const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        userConsent: { findUnique: jest.fn().mockResolvedValue({ id: 'consent-1' }) },
        cart: {
          findUnique: jest.fn(async () => staged.cart),
          update: jest.fn(async ({ data }: any) => (staged.cart = { ...staged.cart, ...data })),
        },
        order: {
          create: jest.fn(async ({ data }: any) => (staged.order = {
            id: 'order-1', crmOrderId: null, crmStatusVersion: 0, cancellationState: 'none', ...data,
          })),
          findUnique: jest.fn(async () => staged.order),
          update: jest.fn(async ({ data }: any) => (staged.order = { ...staged.order, ...data })),
          updateMany: jest.fn(async ({ where, data }: any) => {
            if (!where.status.in.includes(staged.order.status)) return { count: 0 };
            staged.order = { ...staged.order, ...data };
            return { count: 1 };
          }),
        },
        paymentAttempt: {
          findUnique: jest.fn(async () => staged.attempt),
          update: jest.fn(async ({ data }: any) => (staged.attempt = { ...staged.attempt, ...data })),
        },
        emailOutboxEvent: {
          upsert: jest.fn(async ({ where, create }: any) => {
            if (failPersistence) throw new Error('email database persistence failed');
            staged.emails[where.deduplicationKey] ||= { id: `email-${Object.keys(staged.emails).length}`, status: 'pending', ...create };
            return staged.emails[where.deduplicationKey];
          }),
        },
        outboxEvent: {
          upsert: jest.fn(async ({ where, create }: any) => {
            staged.crmEvents[where.deduplicationKey] ||= { id: 'crm-event-1', ...create };
            return staged.crmEvents[where.deduplicationKey];
          }),
        },
      };
      const result = await callback(tx);
      state = staged;
      return result;
    });
  });

  const createRequest = () => ({
    user: { id: 'user-1' }, query: {}, cookies: {},
    body: { offerAcceptance, client: { firstName: 'First', lastName: 'Last', phone: '+79990000000', email: 'customer@example.test' }, deliveryMethod: 'pickup' },
  }) as unknown as Request;
  const noQueue = () => {
    expect(queues.length).toBeGreaterThan(0);
    for (const queue of queues) if (queue?.add) expect(queue.add).not.toHaveBeenCalled();
  };
  const paidFixture = () => {
    state.order = {
      id: 'order-1', userId: 'user-1', status: 'pending', crmOrderId: '77', crmStatusVersion: 0,
      cancellationState: 'none', paymentId: 'payment-1', orderNumber: 'WEB-1', total: 100,
      items, customerFirstName: 'First', customerLastName: 'Last', customerEmail: 'customer@example.test', customerPhone: '+79990000000',
    };
    state.attempt = { id: 'attempt-1', orderId: 'order-1', reservationId: 'reservation-1', providerPaymentId: 'payment-1', status: 'pending', amountMinor: 10000, currency: 'RUB' };
  };
  const cancellationRequest = () => {
    const payload = { crmOrderId: '77', status: 'cancelled', documentNumber: 'WEB-1', version: 1 };
    const canonical = Object.keys(payload).sort().reduce((result: any, key) => ({ ...result, [key]: (payload as any)[key] }), {});
    const signature = crypto.createHmac('sha256', 'f20-webhook-test').update(JSON.stringify(canonical)).digest('hex');
    return { body: payload, headers: { 'x-webhook-signature': signature } } as unknown as Request;
  };

  it('real checkout commits customer and manager events together with order and cleared cart', async () => {
    const res = response();
    await createOrderController(createRequest(), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(state.order.status).toBe('pending');
    expect(state.cart.items).toEqual([]);
    expect(Object.values(state.emails)).toHaveLength(2);
    noQueue();
  });

  it('real checkout outbox insert failure rolls back both order and cart and returns failure', async () => {
    failPersistence = true;
    const res = response();
    await createOrderController(createRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.order).toBeNull();
    expect(state.cart.items).toEqual(items);
    expect(Object.values(state.emails)).toHaveLength(0);
    noQueue();
  });

  it('real payment success and replay commit only one customer and one manager event', async () => {
    paidFixture();
    await handlePaymentSuccess('order-1');
    await handlePaymentSuccess('order-1');
    expect(state.order.status).toBe('paid');
    expect(state.attempt.status).toBe('succeeded');
    expect(Object.values(state.emails)).toHaveLength(2);
    noQueue();
  });

  it('real payment success cannot commit paid state when email persistence fails', async () => {
    paidFixture();
    failPersistence = true;
    await expect(handlePaymentSuccess('order-1')).rejects.toThrow('email database persistence failed');
    expect(state.order.status).toBe('pending');
    expect(state.attempt.status).toBe('pending');
    expect(Object.values(state.emails)).toHaveLength(0);
    noQueue();
  });

  it('signed cancellation callback and replay retain one email and refund intent', async () => {
    paidFixture();
    state.order.status = 'paid';
    state.attempt.status = 'succeeded';
    const first = response();
    const replay = response();
    await handleOrderStatusWebhook(cancellationRequest(), first);
    await handleOrderStatusWebhook(cancellationRequest(), replay);
    expect(first.status).toHaveBeenCalledWith(200);
    expect(replay.json).toHaveBeenCalledWith(expect.objectContaining({ idempotent: true }));
    expect(state.order.status).toBe('cancelled');
    expect(state.attempt.status).toBe('refund_required');
    expect(Object.values(state.emails)).toHaveLength(1);
    expect(Object.values(state.crmEvents)).toHaveLength(1);
    noQueue();
  });

  it('cancellation email persistence failure rolls back status, version and refund intent', async () => {
    paidFixture();
    state.order.status = 'paid';
    state.attempt.status = 'succeeded';
    failPersistence = true;
    const res = response();
    await handleOrderStatusWebhook(cancellationRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.order.status).toBe('paid');
    expect(state.order.crmStatusVersion).toBe(0);
    expect(state.attempt.status).toBe('succeeded');
    expect(Object.values(state.emails)).toHaveLength(0);
    expect(Object.values(state.crmEvents)).toHaveLength(0);
    noQueue();
  });
});
