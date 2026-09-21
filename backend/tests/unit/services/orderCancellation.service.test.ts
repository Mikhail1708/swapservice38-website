import { PrismaClient } from '@prisma/client';
import { requestOrderCancellation } from '../../../src/services/orderCancellation.service';

const prisma = new PrismaClient() as any;

describe('order cancellation service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.upsert.mockImplementation(async ({ create }: any) => ({ id: 'event-1', ...create }));
    prisma.emailOutboxEvent.upsert.mockImplementation(async ({ create }: any) => ({ id: 'email-1', ...create }));
    prisma.order.update.mockImplementation(async ({ data }: any) => ({ id: 'order-1', ...data }));
  });

  it('accepts pre-handoff cancellation, preserves the order, and creates release/refund intents', async () => {
    const order = {
      id: 'order-1', userId: 'user-1', crmOrderId: null, status: 'paid',
      cancellationState: 'none', cancellationRequestedAt: null, cancellationReason: null,
      createdAt: new Date(),
    };
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1', orderId: order.id, providerPaymentId: 'payment-1',
      reservationId: 'reservation-1', status: 'succeeded', amountMinor: 10_000,
      currency: 'RUB', refundRequestedAt: null,
    });

    await requestOrderCancellation(order.id, order.userId, 'customer_request');

    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: order.id },
      data: expect.objectContaining({ status: 'cancelled', cancellationState: 'accepted' }),
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'crm-reservation-release:reservation-1' },
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-refund:payment-1' },
      create: expect.objectContaining({
        payload: expect.objectContaining({ reason: 'pre_handoff_customer_cancellation' }),
      }),
    }));
    expect(prisma.order.delete).not.toHaveBeenCalled();
  });

  it('persists a post-handoff request without changing fulfillment status', async () => {
    const order = {
      id: 'order-1', userId: 'user-1', crmOrderId: '42', status: 'assembling',
      cancellationState: 'none', cancellationRequestedAt: null, cancellationReason: null,
      createdAt: new Date(),
    };
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.paymentAttempt.findUnique.mockResolvedValue({ id: 'attempt-1', status: 'succeeded' });

    await requestOrderCancellation(order.id, order.userId, 'customer_request');

    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cancellationState: 'requested' }),
    }));
    expect(prisma.order.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'crm-order-cancellation:order-1' },
    }));
  });

  it('queues one manager email for a CRM cancellation request without cancelling the order', async () => {
    const previousManagerEmail = process.env.MANAGER_EMAIL;
    process.env.MANAGER_EMAIL = 'manager@example.test';
    const order = {
      id: 'order-1', userId: 'user-1', crmOrderId: '42', orderNumber: 'SO-42',
      customerEmail: 'customer@example.test', status: 'assembling',
      cancellationState: 'none', cancellationRequestedAt: null, cancellationReason: null,
      createdAt: new Date(), user: { firstName: 'Test', lastName: 'Customer' },
    };
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.paymentAttempt.findUnique.mockResolvedValue({ id: 'attempt-1', status: 'succeeded' });

    try {
      await requestOrderCancellation(order.id, order.userId, 'changed mind');
      expect(prisma.emailOutboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { deduplicationKey: 'order-cancellation-email:order-1' },
        create: expect.objectContaining({ eventType: 'order_cancellation_requested' }),
      }));
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ cancellationState: 'requested' }),
      }));
      expect(prisma.order.update).not.toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelled' }),
      }));
    } finally {
      if (previousManagerEmail === undefined) delete process.env.MANAGER_EMAIL;
      else process.env.MANAGER_EMAIL = previousManagerEmail;
    }
  });

  it('rejects a first request after the twelve-hour window', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1', userId: 'user-1', crmOrderId: null, status: 'pending',
      cancellationState: 'none', createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    });

    await expect(requestOrderCancellation('order-1', 'user-1', null))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('keeps a previously persisted request idempotent after the window expires', async () => {
    const requested = {
      id: 'order-1', userId: 'user-1', crmOrderId: '42', status: 'assembling',
      cancellationState: 'requested', cancellationRequestedAt: new Date(),
      createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000), paymentAttempts: [],
    };
    prisma.order.findUnique.mockResolvedValue(requested);

    await expect(requestOrderCancellation('order-1', 'user-1', null)).resolves.toBe(requested);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
  });
});
