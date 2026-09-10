import { Request, Response } from 'express';
import axios from 'axios';
import {
  completeMockPaymentController,
  confirmPaymentController,
  createPaymentController,
} from '../../src/controllers/payment.controller';
import { resetMockPaymentsForTests, handlePaymentSuccess, handlePaymentWebhook } from '../../src/services/payment.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

let storedOrder: any;

type MockCrmOutboxEvent = {
  id: string;
  status: 'pending' | 'processing' | 'dispatched' | 'completed';
  attempts: number;
  processedAt: Date | null;
};

let mockCrmOutboxEvent: MockCrmOutboxEvent | null;
let mockCrmOutboxCreatedCount: number;
let mockCrmDispatchAttemptCount: number;
let mockCrmOutboxClaimCount: number;
let mockCrmDispatchSideEffectCount: number;
let mockCrmOutboxStatusHistory: MockCrmOutboxEvent['status'][];
let mockReconciliationEvent: MockCrmOutboxEvent | null;
let mockPaymentAttemptStatus: 'succeeded' | 'compensation_required';
let mockLogicalCrmOrderCount: number;
let mockReconciliationReplayCount: number;

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
        const statusMatches = !where.status
          || (typeof where.status === 'string' && where.status === storedOrder.status)
          || (Array.isArray(where.status?.in) && where.status.in.includes(storedOrder.status));
        const cancellationMatches = !where.cancellationState?.notIn
          || !where.cancellationState.notIn.includes(storedOrder.cancellationState);
        if (where.id !== storedOrder.id || !statusMatches || !cancellationMatches) {
          return Promise.resolve({ count: 0 });
        }
        storedOrder = { ...storedOrder, ...data };
        return Promise.resolve({ count: 1 });
      }),
    },
    cart: { update: jest.fn().mockResolvedValue({}) },
    paymentAttempt: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((callback: any) => callback(prisma)),
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
jest.mock('../../src/services/paymentAttempt.service', () => ({
  PaymentPreparationError: class PaymentPreparationError extends Error {},
  getOrCreatePaymentAttempt: jest.fn(async (order: any) => ({
    id: 'attempt-1', amountMinor: Math.round(order.total * 100), currency: 'RUB',
    idempotencyKey: 'attempt-key', reservationId: 'reservation-1', providerPaymentId: null,
  })),
  ensureCrmReservation: jest.fn(async (_order: any, attempt: any) => attempt),
  markProviderRequestStarted: jest.fn().mockResolvedValue({}),
  bindProviderPaymentToOrder: jest.fn(async (_attemptId: string, _orderId: string, paymentId: string) => {
    storedOrder = { ...storedOrder, paymentId };
  }),
  markProviderOutcomeUnknown: jest.fn().mockResolvedValue({}),
  markPaymentAttemptCanceled: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/crmOutbox.service', () => {
  const resetCrmOutbox = () => {
    mockCrmOutboxEvent = null;
    mockCrmOutboxCreatedCount = 0;
    mockCrmDispatchAttemptCount = 0;
    mockCrmOutboxClaimCount = 0;
    mockCrmDispatchSideEffectCount = 0;
    mockCrmOutboxStatusHistory = [];
    mockReconciliationEvent = null;
    mockPaymentAttemptStatus = 'succeeded';
    mockLogicalCrmOrderCount = 0;
    mockReconciliationReplayCount = 0;
  };

  return {
    ensureCrmCreateOutboxEvent: jest.fn(async () => {
      if (!mockCrmOutboxEvent) {
        mockCrmOutboxEvent = {
          id: 'event-1',
          status: 'pending',
          attempts: 0,
          processedAt: null,
        };
        mockCrmOutboxCreatedCount += 1;
        mockCrmOutboxStatusHistory.push('pending');
      }
      return mockCrmOutboxEvent;
    }),
    dispatchCrmOutboxEvent: jest.fn(async (eventId: string) => {
      mockCrmDispatchAttemptCount += 1;
      if (!mockCrmOutboxEvent
        || mockCrmOutboxEvent.id !== eventId
        || mockCrmOutboxEvent.status !== 'pending') {
        return false;
      }

      mockCrmOutboxEvent.status = 'processing';
      mockCrmOutboxEvent.attempts += 1;
      mockCrmOutboxClaimCount += 1;
      mockCrmOutboxStatusHistory.push('processing');

      // Models the one durable side effect accepted by Bull. The worker marks
      // the outbox event completed separately after CRM commits the order.
      mockCrmDispatchSideEffectCount += 1;
      mockCrmOutboxEvent.status = 'dispatched';
      mockCrmOutboxStatusHistory.push('dispatched');
      return true;
    }),
    completeCrmOutboxEvent: (eventId: string) => {
      if (!mockCrmOutboxEvent
        || mockCrmOutboxEvent.id !== eventId
        || mockCrmOutboxEvent.status !== 'dispatched') {
        return false;
      }
      mockCrmOutboxEvent.status = 'completed';
      mockCrmOutboxEvent.processedAt = new Date();
      mockCrmOutboxStatusHistory.push('completed');
      return true;
    },
    getCrmOutboxState: () => ({
      event: mockCrmOutboxEvent ? { ...mockCrmOutboxEvent } : null,
      createdCount: mockCrmOutboxCreatedCount,
      dispatchAttemptCount: mockCrmDispatchAttemptCount,
      claimCount: mockCrmOutboxClaimCount,
      dispatchSideEffectCount: mockCrmDispatchSideEffectCount,
      statusHistory: [...mockCrmOutboxStatusHistory],
    }),
    resetCrmOutbox,
    crmCreateDeduplicationKey: (orderId: string) => `crm-order-create:${orderId}`,
    ensurePaymentReconciliationEvent: jest.fn(async () => mockReconciliationEvent),
    dispatchPaymentReconciliationEvent: jest.fn(async (eventId: string) => {
      if (
        !mockReconciliationEvent
        || mockReconciliationEvent.id !== eventId
        || mockReconciliationEvent.status !== 'pending'
      ) return false;
      mockReconciliationEvent.status = 'processing';
      mockReconciliationEvent.attempts += 1;
      mockReconciliationReplayCount += 1;

      // Models timeout-after-commit: CRM already owns one idempotent order and
      // replay returns it instead of creating another logical order.
      if (mockLogicalCrmOrderCount === 0) mockLogicalCrmOrderCount = 1;
      storedOrder = {
        ...storedOrder,
        crmOrderId: 'crm-committed-1',
        orderNumber: 'CRM-1',
        status: 'confirmed',
        crmStatusVersion: 0,
      };
      mockPaymentAttemptStatus = 'succeeded';
      if (mockCrmOutboxEvent) {
        mockCrmOutboxEvent.status = 'completed';
        mockCrmOutboxEvent.processedAt = new Date();
      }
      mockReconciliationEvent.status = 'completed';
      mockReconciliationEvent.processedAt = new Date();
      return true;
    }),
    exhaustCrmRetriesAfterCommittedTimeout: (paymentId: string) => {
      if (!mockCrmOutboxEvent) throw new Error('create outbox is missing');
      mockCrmOutboxEvent.status = 'completed';
      mockCrmOutboxEvent.attempts = 5;
      mockCrmOutboxEvent.processedAt = new Date();
      storedOrder = { ...storedOrder, status: 'crm_failed', crmOrderId: null };
      mockPaymentAttemptStatus = 'compensation_required';
      mockLogicalCrmOrderCount = 1;
      mockReconciliationEvent = {
        id: `payment-reconciliation:${paymentId}`,
        status: 'pending', attempts: 0, processedAt: null,
      };
    },
    getReconciliationState: () => ({
      event: mockReconciliationEvent ? { ...mockReconciliationEvent } : null,
      paymentAttemptStatus: mockPaymentAttemptStatus,
      logicalCrmOrderCount: mockLogicalCrmOrderCount,
      replayCount: mockReconciliationReplayCount,
    }),
    ensurePaymentRefundOutboxEvent: jest.fn().mockResolvedValue({ id: 'refund-event' }),
    dispatchPaymentRefundEvent: jest.fn().mockResolvedValue(true),
  };
});

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
    jest.requireMock('../../src/services/crmOutbox.service').resetCrmOutbox();
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_PROVIDER = 'mock';
    resetMockPaymentsForTests();
    storedOrder = {
      id: 'order-1',
      userId: 'user-1',
      total: 1250.5,
      status: 'pending',
      cancellationState: 'none',
      paymentId: null,
      crmOrderId: null,
      orderNumber: 'ORDER-1',
      items: [{ productId: '1', name: 'Product', price: 1250.5, quantity: 1 }],
      deliveryMethod: 'pickup',
      guestEmail: 'customer@example.com',
      guestPhone: '+79990000000',
    };
    mockedAxios.get.mockResolvedValue({
      data: {
        id: 1,
        name: 'Product',
        price: 1250.5,
        stock: 5,
        sku: 'SKU-1',
        images: [],
      },
    });
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

    const crmOutbox = jest.requireMock('../../src/services/crmOutbox.service');
    const email = jest.requireMock('../../src/services/email.service');
    expect(crmOutbox.getCrmOutboxState()).toMatchObject({
      event: { id: 'event-1', status: 'dispatched', attempts: 1, processedAt: null },
      createdCount: 1,
      dispatchAttemptCount: 2,
      claimCount: 1,
      dispatchSideEffectCount: 1,
      statusHistory: ['pending', 'processing', 'dispatched'],
    });

    expect(crmOutbox.completeCrmOutboxEvent('event-1')).toBe(true);
    expect(crmOutbox.completeCrmOutboxEvent('event-1')).toBe(false);
    expect(crmOutbox.getCrmOutboxState()).toMatchObject({
      event: { id: 'event-1', status: 'completed', attempts: 1 },
      createdCount: 1,
      dispatchAttemptCount: 2,
      claimCount: 1,
      dispatchSideEffectCount: 1,
      statusHistory: ['pending', 'processing', 'dispatched', 'completed'],
    });
    expect(email.sendOrderConfirmationToCustomer).toHaveBeenCalledTimes(1);
    expect(email.sendOrderNotificationToManager).toHaveBeenCalledTimes(1);
  });

  describe('F18 cart belongs to the next checkout after order creation', () => {
    const item = (productId: string, quantity: number) => ({ productId, quantity, name: 'Product', price: 1250.5 });
    const startAndComplete = async () => {
      const created = response();
      await createPaymentController({ body: { orderId: storedOrder.id }, user: { id: storedOrder.userId } } as any, created);
      expect(created.statusCode).toBe(200);
      const completed = response();
      await completeMockPaymentController({ body: { orderId: storedOrder.id, paymentId: created.body.paymentId }, user: { id: storedOrder.userId } } as any, completed);
      expect(completed.statusCode).toBe(200);
      return created.body.paymentId;
    };

    it.each([
      ['new product B', [item('2', 1)]],
      ['cart emptied by checkout', []],
      ['same product re-added with quantity 3', [item('1', 3)]],
      ['same product re-added below checkout quantity', [item('1', 1)]],
      ['product manually removed', []],
      ['new selection for Order 2', [item('1', 2), item('2', 1)]],
    ])('preserves %s through success and sequential/concurrent duplicate confirmation', async (_label, initialItems) => {
      if (_label === 'same product re-added below checkout quantity') {
        storedOrder.items[0].quantity = 3;
        storedOrder.total = storedOrder.items[0].price * 3;
      }
      const prisma = new (jest.requireMock('@prisma/client').PrismaClient)();
      let currentCart = { items: structuredClone(initialItems) };
      prisma.cart.update.mockImplementation(async ({ data }: any) => { currentCart = { ...currentCart, ...data }; return currentCart; });
      const paymentId = await startAndComplete();
      const before = structuredClone(currentCart);
      const confirm = async () => {
        const result = response();
        await confirmPaymentController({ body: { orderId: storedOrder.id, paymentId }, user: { id: storedOrder.userId } } as any, result);
        expect(result.statusCode).toBe(200);
      };
      await Promise.all([confirm(), confirm()]); await confirm();
      expect(storedOrder.status).toBe('paid');
      expect(currentCart).toEqual(before);
      expect(prisma.cart.update).not.toHaveBeenCalled();
    });

    it('a later success replay cannot delete a newly populated cart after Order 2 checkout', async () => {
      const prisma = new (jest.requireMock('@prisma/client').PrismaClient)();
      await startAndComplete(); await handlePaymentSuccess(storedOrder.id);
      let cart = { items: [item('1', 4), item('3', 1)] };
      const before = structuredClone(cart);
      prisma.cart.update.mockImplementation(async ({ data }: any) => { cart = { ...cart, ...data }; return cart; });
      await handlePaymentSuccess(storedOrder.id);
      expect(cart).toEqual(before); expect(prisma.cart.update).not.toHaveBeenCalled();
    });

    it('failed or canceled payment signals do not modify a new cart', async () => {
      const prisma = new (jest.requireMock('@prisma/client').PrismaClient)();
      for (const status of ['failed', 'canceled']) {
        await handlePaymentWebhook({ object: { id: 'payment-1', status, metadata: { orderId: storedOrder.id } } });
      }
      expect(prisma.cart.update).not.toHaveBeenCalled(); expect(storedOrder.status).toBe('pending');
    });
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

  it('recovers exhausted retries after timeout-after-commit without a second CRM order', async () => {
    const createRes = response();
    await createPaymentController({
      body: { orderId: storedOrder.id }, user: { id: storedOrder.userId },
    } as unknown as Request, createRes);
    const completeRes = response();
    await completeMockPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: storedOrder.userId },
    } as unknown as Request, completeRes);
    const confirmRes = response();
    await confirmPaymentController({
      body: { orderId: storedOrder.id, paymentId: createRes.body.paymentId },
      user: { id: storedOrder.userId },
    } as unknown as Request, confirmRes);

    const crmOutbox = jest.requireMock('../../src/services/crmOutbox.service');
    crmOutbox.exhaustCrmRetriesAfterCommittedTimeout(createRes.body.paymentId);
    expect(storedOrder).toMatchObject({ status: 'crm_failed', crmOrderId: null });
    expect(crmOutbox.getReconciliationState()).toMatchObject({
      event: { status: 'pending', attempts: 0 },
      paymentAttemptStatus: 'compensation_required',
      logicalCrmOrderCount: 1,
    });

    const reconciliationId = `payment-reconciliation:${createRes.body.paymentId}`;
    await expect(crmOutbox.dispatchPaymentReconciliationEvent(reconciliationId)).resolves.toBe(true);
    await expect(crmOutbox.dispatchPaymentReconciliationEvent(reconciliationId)).resolves.toBe(false);

    expect(storedOrder).toMatchObject({
      status: 'confirmed', crmOrderId: 'crm-committed-1', orderNumber: 'CRM-1',
    });
    expect(crmOutbox.getCrmOutboxState()).toMatchObject({
      event: { status: 'completed', attempts: 5 }, createdCount: 1,
    });
    expect(crmOutbox.getReconciliationState()).toMatchObject({
      event: { status: 'completed', attempts: 1 },
      paymentAttemptStatus: 'succeeded',
      logicalCrmOrderCount: 1,
      replayCount: 1,
    });
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
