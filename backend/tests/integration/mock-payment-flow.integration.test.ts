import { Request, Response } from 'express';
import {
  completeMockPaymentController,
  confirmPaymentController,
  createPaymentController,
} from '../../src/controllers/payment.controller';
import { resetMockPaymentsForTests } from '../../src/services/payment.service';

let storedOrder: any;

jest.mock('@prisma/client', () => {
  const prisma = {
    order: {
      findFirst: jest.fn(() => Promise.resolve(storedOrder)),
      findUnique: jest.fn(() => Promise.resolve(storedOrder)),
      update: jest.fn(({ data }: any) => {
        storedOrder = { ...storedOrder, ...data };
        return Promise.resolve(storedOrder);
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        if (where.id !== storedOrder.id || (where.status && where.status !== storedOrder.status)) {
          return Promise.resolve({ count: 0 });
        }
        storedOrder = { ...storedOrder, ...data };
        return Promise.resolve({ count: 1 });
      }),
    },
    cart: { update: jest.fn().mockResolvedValue({}) },
  };
  return { PrismaClient: jest.fn(() => prisma) };
});

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  safeRedis: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
  },
  default: {},
}));

jest.mock('../../src/queues/crm.queue', () => ({
  addOrderToCRMQueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));

jest.mock('../../src/services/email.service', () => ({
  sendOrderConfirmationToCustomer: jest.fn().mockResolvedValue(true),
  sendOrderNotificationToManager: jest.fn().mockResolvedValue(true),
}));

const response = () => ({
  statusCode: 200,
  body: undefined as any,
  status: jest.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  }),
  json: jest.fn(function (this: any, body: any) {
    this.body = body;
    return this;
  }),
}) as unknown as Response & { statusCode: number; body: any };

describe('local mock payment flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_PROVIDER = 'mock';
    resetMockPaymentsForTests();
    storedOrder = {
      id: 'order-1',
      userId: 'user-1',
      total: 1250.5,
      status: 'pending',
      paymentId: null,
      crmOrderId: null,
      orderNumber: 'ORDER-1',
      items: [{ productId: '1', name: 'Product', price: 1250.5, quantity: 1 }],
      deliveryMethod: 'pickup',
      guestEmail: 'customer@example.com',
      guestPhone: '+79990000000',
    };
  });

  it('moves pending to succeeded explicitly and confirms through authoritative status', async () => {
    const createRes = response();
    await createPaymentController({
      body: { orderId: storedOrder.id },
      user: { id: storedOrder.userId },
    } as unknown as Request, createRes);

    expect(createRes.statusCode).toBe(200);
    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.paymentId).toMatch(/^mock_/);
    expect(storedOrder.status).toBe('pending');

    const repeatedCreateRes = response();
    await createPaymentController({
      body: { orderId: storedOrder.id },
      user: { id: storedOrder.userId },
    } as unknown as Request, repeatedCreateRes);
    expect(repeatedCreateRes.body.paymentId).toBe(createRes.body.paymentId);
    expect(repeatedCreateRes.body.status).toBe('pending');

    const completeRes = response();
    await completeMockPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: storedOrder.userId },
    } as unknown as Request, completeRes);

    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.payment).toMatchObject({
      id: createRes.body.paymentId,
      status: 'succeeded',
      amount: { value: '1250.50', currency: 'RUB' },
      metadata: { orderId: storedOrder.id },
    });
    expect(storedOrder.status).toBe('pending');

    const confirmRes = response();
    await confirmPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: storedOrder.userId },
    } as unknown as Request, confirmRes);

    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.body).toMatchObject({ success: true, status: 'paid' });
    expect(storedOrder.status).toBe('paid');

    const repeatedConfirmRes = response();
    await confirmPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: storedOrder.userId },
    } as unknown as Request, repeatedConfirmRes);
    expect(repeatedConfirmRes.body).toMatchObject({ alreadyProcessed: true });

    const crmQueue = jest.requireMock('../../src/queues/crm.queue');
    const email = jest.requireMock('../../src/services/email.service');
    expect(crmQueue.addOrderToCRMQueue).toHaveBeenCalledTimes(1);
    expect(email.sendOrderConfirmationToCustomer).toHaveBeenCalledTimes(1);
    expect(email.sendOrderNotificationToManager).toHaveBeenCalledTimes(1);
  });

  it('does not allow another user to complete the payment', async () => {
    const createRes = response();
    await createPaymentController({
      body: { orderId: storedOrder.id },
      user: { id: storedOrder.userId },
    } as unknown as Request, createRes);

    // Simulate the ownership filter performed by Prisma findFirst.
    const { PrismaClient } = jest.requireMock('@prisma/client');
    const prisma = new PrismaClient();
    prisma.order.findFirst.mockResolvedValueOnce(null);
    const completeRes = response();
    await completeMockPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: 'other-user' },
    } as unknown as Request, completeRes);

    expect(completeRes.statusCode).toBe(404);
    expect(storedOrder.status).toBe('pending');
  });

  it('rejects mock provider in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = response();

    await completeMockPaymentController({
      body: { orderId: storedOrder.id, paymentId: 'mock_any' },
      user: { id: storedOrder.userId },
    } as unknown as Request, res);

    expect(res.statusCode).toBe(404);
  });
});
