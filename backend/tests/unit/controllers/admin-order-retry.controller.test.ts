import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { retryOrderToCRM } from '../../../src/controllers/admin/orders.controller';
import {
  acceleratePaymentReconciliationEvent,
  dispatchPaymentReconciliationEvent,
  ensurePaymentReconciliationEvent,
} from '../../../src/services/crmOutbox.service';

const immutableOrderData = {
  contractVersion: 1,
  reservationId: 'reservation-1',
  paymentId: 'payment-1',
  paidAmountMinor: 10_000,
  currency: 'RUB',
  items: [{ productId: 1, quantity: 1 }],
};

jest.mock('@prisma/client', () => {
  const prisma: any = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1', status: 'crm_failed', crmOrderId: null,
      }),
      update: jest.fn(),
    },
    paymentAttempt: {
      findUnique: jest.fn().mockResolvedValue({
        orderId: 'order-1', providerPaymentId: 'payment-1', reservationId: 'reservation-1',
      }),
    },
    outboxEvent: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => (
        where.deduplicationKey === 'payment-refund:payment-1' ? null : {
          payload: { orderId: 'order-1', orderData: {
          contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1',
          paidAmountMinor: 10_000, currency: 'RUB', items: [{ productId: 1, quantity: 1 }],
          } },
        }
      )),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction = jest.fn((callback: any) => callback(prisma));
  return { PrismaClient: jest.fn(() => prisma) };
});
jest.mock('../../../src/queues/crm.queue', () => ({
  addUpdateToCRMQueue: jest.fn(),
  retryFailedOrders: jest.fn(),
}));
jest.mock('../../../src/services/crmOutbox.service', () => ({
  acceleratePaymentReconciliationEvent: jest.fn().mockResolvedValue({ count: 1 }),
  crmCreateDeduplicationKey: (orderId: string) => `crm-order-create:${orderId}`,
  paymentRefundDeduplicationKey: (paymentId: string) => `payment-refund:${paymentId}`,
  ensurePaymentReconciliationEvent: jest.fn().mockResolvedValue({ id: 'reconciliation-event' }),
  dispatchPaymentReconciliationEvent: jest.fn().mockResolvedValue(true),
}));

const mockPrisma = new PrismaClient() as any;

const response = () => ({
  json: jest.fn(),
}) as unknown as Response;

describe('admin durable CRM retry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('atomically accelerates the same reconciliation workflow for duplicate retries', async () => {
    const req = { params: { id: 'order-1' } } as unknown as Request;
    const firstResponse = response();
    const secondResponse = response();

    await retryOrderToCRM(req, firstResponse);
    await retryOrderToCRM(req, secondResponse);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(ensurePaymentReconciliationEvent).toHaveBeenCalledTimes(2);
    expect(ensurePaymentReconciliationEvent).toHaveBeenNthCalledWith(
      1, mockPrisma, 'order-1', 'payment-1', immutableOrderData,
    );
    expect(dispatchPaymentReconciliationEvent).toHaveBeenCalledTimes(2);
    expect(acceleratePaymentReconciliationEvent).toHaveBeenCalledTimes(2);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
    expect(firstResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(secondResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
