jest.unmock('@queues/crm.queue');

import crmQueue, {
  addOrderToCRMQueue,
  addUpdateToCRMQueue,
  markOrderAsFailed,
  processCreateOrder,
} from '../../../src/queues/crm.queue';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

describe('CRM queue idempotency', () => {
  const queue = crmQueue as any;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const prisma = new PrismaClient() as any;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'queued-job' });
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

    await processCreateOrder({ orderId: 'site-order-1', orderData });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/sale-documents/internal/v1/reservations/reservation%2F1/consume'),
      orderData,
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }) }),
    );
    expect(mockedAxios.post.mock.calls[0][0]).not.toContain('/public');
  });

  it('durably requests a refund when a paid reservation expired', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-1',
      providerPaymentId: 'payment-1',
      amountMinor: 10_000,
      currency: 'RUB',
    });
    prisma.paymentAttempt.update.mockResolvedValueOnce({});
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.upsert.mockResolvedValueOnce({ id: 'refund-event' });

    await markOrderAsFailed('createOrder', {
      orderId: 'site-order-1',
      orderData: { contractVersion: 1, reservationId: 'reservation-1' },
    }, {
      response: { data: { code: 'RESERVATION_EXPIRED' } },
    });

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'compensation_required' }),
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-refund:payment-1' },
      create: expect.objectContaining({ type: 'payment_refund_requested' }),
    }));
  });

  it('durably records reconciliation for other permanent reservation failures', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-2', providerPaymentId: 'payment-2', amountMinor: 12_000, currency: 'RUB',
    });
    prisma.paymentAttempt.update.mockResolvedValueOnce({});
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEvent.upsert.mockResolvedValueOnce({ id: 'reconciliation-event' });

    await markOrderAsFailed('createOrder', {
      orderId: 'site-order-2',
      orderData: { contractVersion: 1, reservationId: 'reservation-2' },
    }, { response: { status: 409, data: { message: 'Reservation was released' } } });

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'compensation_required' }),
    }));
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-reconciliation:payment-2' },
      create: expect.objectContaining({ type: 'payment_reconciliation_required' }),
    }));
  });
});
