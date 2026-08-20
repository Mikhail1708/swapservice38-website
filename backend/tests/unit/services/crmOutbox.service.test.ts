import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { addOrderToCRMQueue } from '../../../src/queues/crm.queue';
import {
  crmCreateDeduplicationKey,
  dispatchCrmOutboxEvent,
  dispatchPaymentRefundEvent,
  ensureCrmCreateOutboxEvent,
  reconcileCrmOutbox,
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
    expect(mockPrisma.outboxEvent.update).toHaveBeenLastCalledWith(expect.objectContaining({
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
    expect(mockPrisma.outboxEvent.update).toHaveBeenLastCalledWith(expect.objectContaining({
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
    mockedAxios.post.mockResolvedValueOnce({ data: { status: 'succeeded' } } as any);
    (mockPrisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({});

    await expect(dispatchPaymentRefundEvent('refund-event')).resolves.toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.yookassa.ru/v3/refunds',
      expect.objectContaining({ payment_id: 'payment-1', amount: { value: '200.00', currency: 'RUB' } }),
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotence-Key': 'payment-refund:payment-1' }) }),
    );
    expect(mockPrisma.paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'refunded' }),
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
