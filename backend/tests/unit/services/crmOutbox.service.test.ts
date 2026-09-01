import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { addOrderToCRMQueue } from '../../../src/queues/crm.queue';
import {
  acceleratePaymentReconciliationEvent,
  crmCreateDeduplicationKey,
  dispatchCrmOutboxEvent,
  dispatchCrmOutboxOnce,
  dispatchPaymentReconciliationEvent,
  dispatchPaymentRefundEvent,
  ensureCrmCreateOutboxEvent,
  ensurePaymentReconciliationEvent,
  reconcileCrmOutbox,
  replayFailedPaymentRefund,
} from '../../../src/services/crmOutbox.service';

jest.mock('../../../src/queues/crm.queue', () => ({
  addOrderToCRMQueue: jest.fn(),
}));
jest.mock('axios');

const mockedAdd = addOrderToCRMQueue as jest.Mock;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockPrisma = new PrismaClient() as any;

describe('CRM transactional outbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockReset().mockResolvedValue(null);
    (mockPrisma.order.findUnique as jest.Mock).mockReset().mockResolvedValue({
      id: 'order-1', status: 'pending', crmOrderId: null,
    });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockReset().mockResolvedValue(null);
  });

  it('uses one deterministic event per order', async () => {
    (mockPrisma.outboxEvent.upsert as jest.Mock).mockResolvedValue({ id: 'event-1' });
    await ensureCrmCreateOutboxEvent(mockPrisma as any, 'order-1', { externalOrderId: 'order-1' });
    expect(mockPrisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: crmCreateDeduplicationKey('order-1') },
      create: expect.objectContaining({ aggregateId: 'order-1', type: 'crm_order_create_requested' }),
    }));
  });

  it('does not dispatch an event another worker already claimed', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    await expect(dispatchCrmOutboxEvent('event-1')).resolves.toBe(false);
    expect(mockedAdd).not.toHaveBeenCalled();
  });

  it('marks the event dispatched only after Bull accepts the deterministic job', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'event-1', aggregateId: 'order-1', attempts: 1,
      payload: { orderId: 'order-1', orderData: { reservationId: 'reservation-1' } },
    });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({});
    mockedAdd.mockResolvedValue({ id: 'crm-create-order-1' });

    await expect(dispatchCrmOutboxEvent('event-1')).resolves.toBe(true);
    expect(mockedAdd).toHaveBeenCalledWith('order-1', { reservationId: 'reservation-1' });
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'dispatched' }),
    }));
  });

  it('keeps the event durable and retryable when Redis/Bull is unavailable', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'event-1', aggregateId: 'order-1', attempts: 2,
      payload: { orderId: 'order-1', orderData: {} },
    });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({});
    mockedAdd.mockRejectedValue(new Error('Redis unavailable'));

    await expect(dispatchCrmOutboxEvent('event-1')).resolves.toBe(false);
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'pending', lastError: 'Redis unavailable' }),
    }));
  });

  it('idempotently completes a durable automatic refund', async () => {
    process.env.PAYMENT_PROVIDER = 'yookassa';
    process.env.YOO_KASSA_SHOP_ID = 'shop';
    process.env.YOO_KASSA_SECRET_KEY = 'secret';
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'refund-event', aggregateId: 'order-1', attempts: 1,
      deduplicationKey: 'payment-refund:payment-1',
      payload: { orderId: 'order-1', paymentId: 'payment-1', amountMinor: 20_000, currency: 'RUB' },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ crmOrderId: null });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
      id: 'attempt-1', orderId: 'order-1', providerPaymentId: 'payment-1',
      status: 'compensation_required', refundRequestedAt: null,
    });
    mockedAxios.post.mockResolvedValueOnce({ data: { status: 'succeeded' } } as any);
    (mockPrisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({});

    await expect(dispatchPaymentRefundEvent('refund-event')).resolves.toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.yookassa.ru/v3/refunds',
      expect.objectContaining({ payment_id: 'payment-1', amount: { value: '200.00', currency: 'RUB' } }),
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotence-Key': 'payment-refund:payment-1' }) }),
    );
    expect(mockPrisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'refunded' }),
    }));
  });

  it('moves an exhausted refund to operator-visible refund_failed', async () => {
    process.env.PAYMENT_PROVIDER = 'yookassa';
    process.env.YOO_KASSA_SHOP_ID = 'shop';
    process.env.YOO_KASSA_SECRET_KEY = 'secret';
    process.env.REFUND_MAX_ATTEMPTS = '8';
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'refund-event', aggregateId: 'order-1', attempts: 8,
      deduplicationKey: 'payment-refund:payment-1',
      payload: {
        orderId: 'order-1', paymentId: 'payment-1', amountMinor: 20_000,
        currency: 'RUB', reason: 'pre_handoff_compensation',
      },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ crmOrderId: null });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
      id: 'attempt-1', providerPaymentId: 'payment-1', status: 'compensation_required',
      refundRequestedAt: null,
    });
    mockedAxios.post.mockRejectedValueOnce(new Error('provider timeout'));

    await expect(dispatchPaymentRefundEvent('refund-event')).resolves.toBe(false);

    expect(mockPrisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'refund_failed', lastError: 'provider timeout' }),
    }));
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', lastError: 'provider timeout' }),
    }));
  });

  it('replays only the same failed deterministic refund intent', async () => {
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
      id: 'attempt-1', providerPaymentId: 'payment-1', status: 'refund_failed',
      refundReason: 'post_handoff_cancellation',
    });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'refund-event', type: 'payment_refund_requested', status: 'failed', processedAt: null,
    });
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({ status: 'refund_required' });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({ id: 'refund-event', status: 'pending' });

    await expect(replayFailedPaymentRefund('order-1')).resolves.toEqual(expect.objectContaining({
      outboxEvent: expect.objectContaining({ id: 'refund-event', status: 'pending' }),
    }));
    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'refund_required' }),
    }));
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'pending', attempts: 0 }),
    }));
  });

  it('creates one deterministic reconciliation marker without erasing its backoff', async () => {
    (mockPrisma.outboxEvent.upsert as jest.Mock).mockResolvedValue({
      id: 'reconciliation-event', status: 'pending', processedAt: null,
    });
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await ensurePaymentReconciliationEvent(
      mockPrisma as any, 'order-1', 'payment-1',
      { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' },
    );

    expect(mockPrisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'payment-reconciliation:payment-1' },
      create: expect.objectContaining({ type: 'payment_reconciliation_required' }),
      update: {},
    }));
    expect(mockPrisma.outboxEvent.updateMany).not.toHaveBeenCalled();

    await acceleratePaymentReconciliationEvent(mockPrisma as any, 'reconciliation-event');
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'pending', processedAt: null }),
      data: { nextAttemptAt: expect.any(Date) },
    }));
  });

  it('claims reconciliation separately and replays its immutable payload', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'reconciliation-event', aggregateId: 'order-1', attempts: 1,
      payload: {
        orderId: 'order-1',
        paymentId: 'payment-1',
        orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' },
      },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'order-1', status: 'crm_failed', crmOrderId: null,
    });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValueOnce({
      orderId: 'order-1', providerPaymentId: 'payment-1', status: 'compensation_required',
    });
    mockedAdd.mockResolvedValue({ id: 'crm-create-order-1' });

    await expect(dispatchPaymentReconciliationEvent('reconciliation-event')).resolves.toBe(true);
    expect(mockedAdd).toHaveBeenCalledWith('order-1', {
      contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1',
    }, { replayCompleted: true });
  });

  it('allows only one reconciliation CAS claimant', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'reconciliation-event', aggregateId: 'order-1', attempts: 1,
      payload: {
        orderId: 'order-1', paymentId: 'payment-1',
        orderData: { contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1' },
      },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1', status: 'crm_failed', crmOrderId: null,
    });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
      orderId: 'order-1', providerPaymentId: 'payment-1', status: 'compensation_required',
    });
    mockedAdd.mockResolvedValue({ id: 'job-1' });

    const results = await Promise.all([
      dispatchPaymentReconciliationEvent('reconciliation-event'),
      dispatchPaymentReconciliationEvent('reconciliation-event'),
    ]);

    expect(results.sort()).toEqual([false, true]);
    expect(mockedAdd).toHaveBeenCalledTimes(1);
  });

  it('falls back only to the immutable original create-event payload', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'reconciliation-event', aggregateId: 'order-1', attempts: 1,
        payload: { orderId: 'order-1', paymentId: 'payment-1' },
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        payload: { orderData: {
          contractVersion: 1, reservationId: 'immutable-reservation', paymentId: 'payment-1',
        } },
      });
    mockedAdd.mockResolvedValue({ id: 'crm-create-order-1' });

    await expect(dispatchPaymentReconciliationEvent('reconciliation-event')).resolves.toBe(true);
    expect(mockedAdd).toHaveBeenCalledWith(
      'order-1', expect.objectContaining({ reservationId: 'immutable-reservation' }),
      { replayCompleted: true },
    );
  });

  it('keeps transient reconciliation failures pending with a CAS update', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'reconciliation-event', aggregateId: 'order-1', attempts: 3,
      payload: { orderId: 'order-1', paymentId: 'payment-1', orderData: {
        contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1',
      } },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'order-1', status: 'crm_failed', crmOrderId: null,
    });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValueOnce({
      orderId: 'order-1', providerPaymentId: 'payment-1', status: 'compensation_required',
    });
    mockedAdd.mockRejectedValueOnce(new Error('Redis timeout'));

    await expect(dispatchPaymentReconciliationEvent('reconciliation-event')).resolves.toBe(false);
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'processing', processedAt: null }),
      data: expect.objectContaining({ status: 'pending', lastError: 'Redis timeout' }),
    }));
  });

  it('selects reconciliation events and includes them in stale lease recovery', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.order.findMany as jest.Mock).mockResolvedValueOnce([]);
    (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValueOnce([]);

    await dispatchCrmOutboxOnce();

    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: { in: expect.arrayContaining(['payment_reconciliation_required']) },
        OR: expect.arrayContaining([
          expect.objectContaining({ status: 'processing' }),
          expect.objectContaining({ status: 'dispatched' }),
        ]),
      }),
    }));
    expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: { in: expect.arrayContaining(['payment_reconciliation_required']) },
      }),
    }));
  });

  it('does not regress a completed event to pending after ambiguous Bull failure', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'event-1', aggregateId: 'order-1', attempts: 1,
      payload: { orderId: 'order-1', orderData: {} },
    });
    mockedAdd.mockRejectedValueOnce(new Error('ambiguous enqueue'));
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });

    await expect(dispatchCrmOutboxEvent('event-1')).resolves.toBe(false);
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'event-1', status: 'processing', processedAt: null },
      data: expect.objectContaining({ status: 'pending' }),
    }));
  });

  it('refuses automatic refund when a CRM order is already known', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'refund-event', aggregateId: 'order-1', attempts: 1,
      deduplicationKey: 'payment-refund:payment-1',
      payload: { orderId: 'order-1', paymentId: 'payment-1', amountMinor: 100, currency: 'RUB' },
    });
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValueOnce({ crmOrderId: 'crm-1' });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValueOnce({
      providerPaymentId: 'payment-1', status: 'compensation_required',
    });

    await expect(dispatchPaymentRefundEvent('refund-event')).resolves.toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'pending' }),
    }));
  });

  it('hydrates migration repair markers before dispatching legacy paid orders', async () => {
    (mockPrisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.order.findMany as jest.Mock).mockResolvedValueOnce([{
      id: 'legacy-order',
      items: [{ productId: 1, quantity: 1, price: 250 }],
      customerPhone: '+7 900 000-00-00',
      paymentAttempts: [],
      user: null,
    }]);
    (mockPrisma.outboxEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'repair-event',
      status: 'pending',
      payload: { orderId: 'legacy-order', legacyRepair: true },
    });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({});

    await reconcileCrmOutbox();

    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'repair-event' },
      data: { payload: expect.objectContaining({
        orderId: 'legacy-order',
        orderData: expect.objectContaining({ externalOrderId: 'legacy-order' }),
      }) },
    });
  });
});
