import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import {
  bindProviderPaymentToOrder,
  ensureCrmReservation,
  getOrCreatePaymentAttempt,
  PaymentPreparationError,
} from '../../../src/services/paymentAttempt.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockPrisma = new PrismaClient() as any;

const order = {
  id: 'order-1',
  total: 200,
  items: [{ productId: 10, quantity: 2, price: 100 }],
};

const attempt = {
  id: 'attempt-1',
  orderId: order.id,
  reservationId: null,
  amountMinor: 20_000,
  currency: 'RUB',
};

describe('durable payment attempt and CRM reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists the payment attempt before external calls', async () => {
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.paymentAttempt.create as jest.Mock).mockResolvedValue(attempt);
    await getOrCreatePaymentAttempt(order, 'yookassa');
    expect(mockPrisma.paymentAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: order.id, amountMinor: 20_000, status: 'initiating' }),
    });
  });

  it('accepts and persists only an exact locked line-price quote', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {
      reservationId: 'reservation-1', status: 'active', currency: 'RUB', totalMinor: 20_000,
      expiresAt: '2026-08-20T12:00:00.000Z',
      items: [{ productId: 10, quantity: 2, unitPriceMinor: 10_000, totalMinor: 20_000 }],
    } } as any);
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...order, status: 'pending', cancellationState: 'none' });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue(attempt);
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({ ...attempt, reservationId: 'reservation-1' });

    await ensureCrmReservation(order, attempt);
    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reservationId: 'reservation-1', amountMinor: 20_000 }),
    }));
  });

  it('durably releases a reservation created concurrently with cancellation', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {
      reservationId: 'reservation-race', status: 'active', currency: 'RUB', totalMinor: 20_000,
      expiresAt: '2026-09-01T12:00:00.000Z',
      items: [{ productId: 10, quantity: 2, unitPriceMinor: 10_000, totalMinor: 20_000 }],
    } } as any);
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...order, status: 'cancelled', cancellationState: 'accepted',
    });
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue(attempt);
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({
      ...attempt, reservationId: 'reservation-race',
    });
    (mockPrisma.outboxEvent.upsert as jest.Mock).mockResolvedValue({ id: 'release-event' });

    await expect(ensureCrmReservation(order, attempt)).rejects.toMatchObject({
      status: 409, code: 'ORDER_CANCELLATION_ACTIVE',
    });
    expect(mockPrisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'crm-reservation-release:reservation-race' },
      create: expect.objectContaining({ type: 'crm_reservation_release_requested' }),
    }));
  });

  it('releases a quote when line prices drift even if the total happens to match', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: {
        reservationId: 'reservation-1', status: 'active', currency: 'RUB', totalMinor: 20_000,
        items: [{ productId: 10, quantity: 2, unitPriceMinor: 9_999, totalMinor: 20_000 }],
      } } as any)
      .mockResolvedValueOnce({ data: { status: 'released' } } as any);
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});

    await expect(ensureCrmReservation(order, attempt)).rejects.toMatchObject<Partial<PaymentPreparationError>>({
      code: 'ORDER_PRICE_CHANGED', status: 409,
    });
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('keeps an ambiguous CRM timeout non-terminal and retryable', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('timeout'));
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});

    await expect(ensureCrmReservation(order, attempt)).rejects.toMatchObject({ status: 503 });
    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'unknown' }),
    }));
  });

  it('does not start a provider payment against an expired local reservation', async () => {
    await expect(ensureCrmReservation(order, {
      ...attempt,
      reservationId: 'reservation-expired',
      reservationExpiresAt: new Date(Date.now() - 1_000),
    })).rejects.toMatchObject({ status: 409, code: 'RESERVATION_EXPIRED' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('fails checkout when CRM rejects a zero-free-stock reservation', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Insufficient stock' } } });
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});
    await expect(ensureCrmReservation(order, attempt)).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.paymentAttempt.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reservationId: expect.any(String) }),
    }));
  });

  it('binds provider identity in Order then PaymentAttempt lock order', async () => {
    (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(order);
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue(attempt);
    (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...order, paymentId: 'payment-1' });

    await bindProviderPaymentToOrder(attempt.id, order.id, 'payment-1', 'pending');

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: attempt.id }, data: expect.objectContaining({ providerPaymentId: 'payment-1' }),
    }));
    expect(mockPrisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: order.id }, data: { paymentId: 'payment-1' },
    }));
    expect(mockPrisma.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(mockPrisma.paymentAttempt.update.mock.invocationCallOrder[0]);
    expect(mockPrisma.paymentAttempt.update.mock.invocationCallOrder[0])
      .toBeLessThan(mockPrisma.order.update.mock.invocationCallOrder[0]);
  });
});
