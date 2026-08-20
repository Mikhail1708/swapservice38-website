import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import {
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
    (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({ ...attempt, reservationId: 'reservation-1' });

    await ensureCrmReservation(order, attempt);
    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reservationId: 'reservation-1', amountMinor: 20_000 }),
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
});
