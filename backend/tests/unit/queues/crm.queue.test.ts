jest.unmock('@queues/crm.queue');

import crmQueue, {
  addOrderToCRMQueue,
  addUpdateToCRMQueue,
  getCrmQueueRedisOptions,
  markOrderAsFailed,
  processCreateOrder,
} from '../../../src/queues/crm.queue';
import axios from 'axios';
import * as delivery from '../../../src/services/crmDelivery.service';
import { PrismaClient } from '@prisma/client';

describe('CRM queue idempotency', () => {
  const queue = crmQueue as any;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const prisma = new PrismaClient() as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.outboxEvent.findUnique.mockReset().mockResolvedValue(null);
    prisma.order.findUnique.mockReset().mockResolvedValue({ id: "site-order-1", status: "paid", crmOrderId: null, crmStatusVersion: 0 });
    mockedAxios.post.mockReset();
    jest.spyOn(delivery, 'claimCrmDelivery').mockReset();
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'queued-job' });
  });

  it('passes the configured Redis password to Bull', () => {
    const previousPassword = process.env.REDIS_PASSWORD;
    process.env.REDIS_PASSWORD = 'redis-test-password';
    expect(getCrmQueueRedisOptions()).toEqual(expect.objectContaining({
      host: process.env.REDIS_HOST || 'localhost',
      password: 'redis-test-password',
      connectTimeout: 5000,
    }));
    if (previousPassword === undefined) delete process.env.REDIS_PASSWORD;
    else process.env.REDIS_PASSWORD = previousPassword;
  });

  it('uses a deterministic create job id and adds the external order id', async () => {
    await addOrderToCRMQueue('site-order-1', {
      source: 'website_retry',
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(queue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'createOrder',
        data: expect.objectContaining({
          orderId: 'site-order-1',
          orderData: expect.objectContaining({
            externalOrderId: 'site-order-1',
            source: 'website',
            sourceDetail: 'website_retry',
          }),
        }),
      }),
      expect.objectContaining({ jobId: 'crm-create-site-order-1' }),
    );
  });

  it('builds the same update job id for semantically identical payloads', async () => {
    await addUpdateToCRMQueue('site-order-1', 'crm-1', { comment: 'x', items: [] });
    await addUpdateToCRMQueue('site-order-1', 'crm-1', { items: [], comment: 'x' });

    const firstOptions = queue.add.mock.calls[0][1];
    const secondOptions = queue.add.mock.calls[1][1];
    expect(firstOptions.jobId).toBe(secondOptions.jobId);
    expect(firstOptions.jobId).toMatch(/^crm-update-site-order-1-[a-f0-9]{16}$/);
  });

  it('does not enqueue a duplicate existing job', async () => {
    const existingJob = { id: 'existing', isFailed: jest.fn().mockResolvedValue(false) };
    queue.getJob.mockResolvedValue(existingJob);

    await expect(addOrderToCRMQueue('site-order-1', {})).resolves.toBe(existingJob);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('recreates a completed deterministic job only for explicit reconciliation replay', async () => {
    const existingJob = {
      id: 'existing', isFailed: jest.fn().mockResolvedValue(false),
      isCompleted: jest.fn().mockResolvedValue(true), remove: jest.fn().mockResolvedValue(undefined),
    };
    queue.getJob.mockResolvedValue(existingJob);

    await addOrderToCRMQueue('site-order-1', {}, { replayCompleted: true });

    expect(existingJob.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: 'crm-create-site-order-1',
    }));
  });

  it('routes reserved paid orders only to the versioned consume contract', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {
      orderId: 42,
      documentNumber: 'ORDER-42',
      orderStatus: 'confirmed',
      statusVersion: 0,
    } } as any);
    const orderData = {
      externalOrderId: 'site-order-1',
      reservationId: 'reservation/1',
      contractVersion: 1,
      paymentId: 'payment-1',
      paidAmountMinor: 10_000,
      currency: 'RUB',
      items: [{ productId: 1, quantity: 1 }],
    };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'site-order-1', status: 'crm_failed', crmOrderId: null, crmStatusVersion: 0,
    });
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1', orderId: 'site-order-1', providerPaymentId: 'payment-1',
      status: 'compensation_required',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });

    jest.mocked(delivery.claimCrmDelivery).mockResolvedValueOnce({ claim: { id: 'create', orderId: 'site-order-1', attempts: 1, lockedAt: new Date() }, orderData } as any);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    await processCreateOrder({ orderId: 'site-order-1', orderData });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function), { maxWait: 5_000, timeout: 10_000 },
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/sale-documents/internal/v1/reservations/reservation%2F1/consume'),
      orderData,
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }) }),
    );
    expect(mockedAxios.post.mock.calls[0][0]).not.toContain('/public');
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['succeeded', 'compensation_required'] } }),
      data: expect.objectContaining({ status: 'succeeded', lastError: null }),
    }));
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
      }),
      data: expect.objectContaining({ status: 'completed' }),
    }));
  });

  it('stops a legacy create before HTTP when cancellation won before handoff', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'site-order-legacy', status: 'paid', crmOrderId: null,
      cancellationState: 'requested', cancellationRequestedAt: new Date(),
      cancellationReason: 'customer_request', crmStatusVersion: 0,
    });
    prisma.paymentAttempt.findUnique.mockResolvedValueOnce(null);
    prisma.outboxEvent.findUnique.mockResolvedValueOnce(null);
    prisma.order.update.mockResolvedValueOnce({ id: 'site-order-legacy', status: 'cancelled' });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(processCreateOrder({
      orderId: 'site-order-legacy',
      orderData: { externalOrderId: 'site-order-legacy', items: [] },
    })).resolves.toEqual({ cancelledBeforeHandoff: true });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled', cancellationState: 'accepted' }),
    }));
  });

  it('preserves ambiguous handoff and atomically refunds an authoritative cancelled response', async () => {
    const currentOrder = {
      id: 'site-order-1', status: 'paid', crmOrderId: null, crmStatusVersion: 0,
      cancellationState: 'requested', cancellationRequestedAt: new Date(),
      cancellationReason: 'customer_request',
    };
    const currentAttempt = {
      id: 'attempt-1', orderId: currentOrder.id, providerPaymentId: 'payment-1',
      reservationId: 'reservation-1', status: 'succeeded', amountMinor: 10_000,
      currency: 'RUB', refundRequestedAt: null, lastError: null,
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(currentOrder)
      .mockResolvedValueOnce(currentOrder);
    prisma.paymentAttempt.findUnique.mockResolvedValue(currentAttempt);
    prisma.outboxEvent.findUnique.mockImplementation(async ({ where }) =>
      where.deduplicationKey === `crm-order-create:${currentOrder.id}` ? {
        id: 'create-event',
        payload: { orderId: currentOrder.id, orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' }, handoffAttempted: true },
      } : null);
    prisma.paymentAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.paymentAttempt.update.mockResolvedValueOnce({ ...currentAttempt, status: 'refund_required' });
    prisma.outboxEvent.upsert.mockResolvedValue({ id: 'event' });
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockedAxios.post.mockResolvedValueOnce({ data: {
      orderId: 42, documentNumber: 'ORDER-42', orderStatus: 'cancelled', statusVersion: 1,
    } } as any);

    jest.mocked(delivery.claimCrmDelivery).mockResolvedValueOnce({ claim: { id: 'create', orderId: currentOrder.id, attempts: 1, lockedAt: new Date() }, orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' } } as any);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    await processCreateOrder({
      orderId: currentOrder.id,
      orderData: {
        externalOrderId: currentOrder.id, reservationId: 'reservation-1', contractVersion: 1,
        paymentId: 'payment-1', paidAmountMinor: 10_000, currency: 'RUB', items: [],
      },
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled', cancellationState: 'accepted' }),
    }));
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'refund_required', refundReason: 'post_handoff_cancellation' }),
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-refund:payment-1' },
      create: expect.objectContaining({
        payload: expect.objectContaining({ reason: 'post_handoff_cancellation' }),
      }),
    }));
  });

  it('durably requests a refund when a paid reservation expired', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1',
      providerPaymentId: 'payment-1',
      amountMinor: 10_000,
      currency: 'RUB',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.upsert.mockResolvedValueOnce({ id: 'refund-event' });

    await markOrderAsFailed('createOrder', {
      orderId: 'site-order-1',
      orderData: { contractVersion: 1, reservationId: 'reservation-1' },
    }, {
      response: { data: { code: 'RESERVATION_EXPIRED' } },
    });

    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'compensation_required' }),
    }));
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-refund:payment-1' },
      create: expect.objectContaining({ type: 'payment_refund_requested' }),
    }));
  });

  it('uses one deterministic refund event for duplicate RESERVATION_EXPIRED finalizers', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1', providerPaymentId: 'payment-1', amountMinor: 10_000, currency: 'RUB',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.upsert.mockResolvedValue({ id: 'refund-event' });
    const job = {
      orderId: 'site-order-1',
      orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' },
    };
    const expired = { response: { data: { code: 'RESERVATION_EXPIRED' } } };

    await markOrderAsFailed('createOrder', job, expired);
    await markOrderAsFailed('createOrder', job, expired);

    expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(2);
    for (const [argument] of prisma.outboxEvent.upsert.mock.calls) {
      expect(argument).toEqual(expect.objectContaining({
        where: { deduplicationKey: 'payment-refund:payment-1' }, update: {},
      }));
    }
  });

  it('retains permanent reservation failures without starting another reconciliation cycle', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-2', providerPaymentId: 'payment-2', amountMinor: 12_000, currency: 'RUB',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.upsert.mockResolvedValueOnce({ id: 'reconciliation-event' });

    await markOrderAsFailed('createOrder', {
      orderId: 'site-order-2',
      orderData: { contractVersion: 1, reservationId: 'reservation-2' },
    }, { response: { status: 409, data: { message: 'Reservation was released' } } });

    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'compensation_required' }),
    }));
    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', processedAt: null, lastError: expect.any(String) }),
    }));
  });

  it('does not persist CRM success over a refunded payment', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {
      orderId: 42, documentNumber: 'ORDER-42', orderStatus: 'confirmed', statusVersion: 0,
    } } as any);
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'site-order-1', status: 'crm_failed', crmOrderId: null, crmStatusVersion: 0,
    });
    prisma.paymentAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-1', providerPaymentId: 'payment-1', status: 'refunded',
    });

    await expect(processCreateOrder({
      orderId: 'site-order-1',
      orderData: {
        externalOrderId: 'site-order-1', reservationId: 'reservation-1', contractVersion: 1,
        paymentId: 'payment-1', paidAmountMinor: 100, currency: 'RUB', items: [],
      },
    })).resolves.toEqual({ cancelledBeforeHandoff: true });
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back a late exhausted worker after CRM success wins the order CAS', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1', providerPaymentId: 'payment-1', amountMinor: 10_000, currency: 'RUB',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await markOrderAsFailed('createOrder', {
      orderId: 'site-order-1',
      orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' },
    }, new Error('late failure'));

    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
  });
});
