// backend/tests/unit/services/payment.service.test.ts
import { 
  createPayment, 
  handlePaymentSuccess, 
  handlePaymentWebhook,
  getPaymentStatus,
  resendOrderToCRM
} from '../../../src/services/payment.service';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { safeRedis } from '../../../src/config/redis';
import {
  assertCheckoutSnapshotStillCurrent,
  CheckoutInventoryError,
} from '../../../src/services/checkoutInventory.service';
import {
  dispatchPaymentReconciliationEvent,
  ensureCrmCreateOutboxEvent,
  ensurePaymentReconciliationEvent,
} from '../../../src/services/crmOutbox.service';
import { ensureCrmReservation } from '../../../src/services/paymentAttempt.service';

// ============================================================
// МОКИ
// ============================================================
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    cart: {
      update: jest.fn(),
    },
    paymentAttempt: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    outboxEvent: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

jest.mock('axios');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/queues/crm.queue', () => ({
  addOrderToCRMQueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
  retryFailedOrders: jest.fn().mockResolvedValue({ retried: 0 }),
}));

jest.mock('../../../src/services/email.service', () => ({
  sendOrderConfirmationToCustomer: jest.fn().mockResolvedValue(true),
  sendOrderNotificationToManager: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../src/services/checkoutInventory.service', () => {
  const actual = jest.requireActual('../../../src/services/checkoutInventory.service');
  return { ...actual, assertCheckoutSnapshotStillCurrent: jest.fn() };
});
jest.mock('../../../src/services/paymentAttempt.service', () => ({
  PaymentPreparationError: class PaymentPreparationError extends Error {},
  getOrCreatePaymentAttempt: jest.fn(async (order: any) => ({
    id: 'attempt-1', amountMinor: Math.round(order.total * 100), currency: 'RUB',
    idempotencyKey: 'attempt-key', reservationId: 'reservation-1', providerPaymentId: null,
  })),
  ensureCrmReservation: jest.fn(async (_order: any, attempt: any) => attempt),
  markProviderRequestStarted: jest.fn().mockResolvedValue({}),
  bindProviderPaymentToOrder: jest.fn().mockResolvedValue([]),
  markProviderOutcomeUnknown: jest.fn().mockResolvedValue({}),
  markPaymentAttemptCanceled: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/crmOutbox.service', () => ({
  acceleratePaymentReconciliationEvent: jest.fn().mockResolvedValue({ count: 1 }),
  ensureCrmCreateOutboxEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
  dispatchCrmOutboxEvent: jest.fn().mockResolvedValue(true),
  ensurePaymentReconciliationEvent: jest.fn().mockResolvedValue({ id: 'reconciliation-event' }),
  dispatchPaymentReconciliationEvent: jest.fn().mockResolvedValue(true),
  crmCreateDeduplicationKey: (orderId: string) => `crm-order-create:${orderId}`,
  ensurePaymentRefundOutboxEvent: jest.fn().mockResolvedValue({ id: 'refund-event' }),
  dispatchPaymentRefundEvent: jest.fn().mockResolvedValue(true),
  paymentRefundDeduplicationKey: (paymentId: string) => `payment-refund:${paymentId}`,
  paymentReconciliationDeduplicationKey: (paymentId: string) => `payment-reconciliation:${paymentId}`,
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
const mockRedis = safeRedis as jest.Mocked<typeof safeRedis>;
const mockedAssertCheckoutSnapshotStillCurrent = assertCheckoutSnapshotStillCurrent as jest.Mock;
const mockedEnsureCrmCreateOutboxEvent = ensureCrmCreateOutboxEvent as jest.Mock;
const mockedEnsurePaymentReconciliationEvent = ensurePaymentReconciliationEvent as jest.Mock;
const mockedDispatchPaymentReconciliationEvent = dispatchPaymentReconciliationEvent as jest.Mock;
const mockedEnsureCrmReservation = ensureCrmReservation as jest.Mock;

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.YOO_KASSA_SHOP_ID = 'test-shop';
    process.env.YOO_KASSA_SECRET_KEY = 'test-secret';
    process.env.CLIENT_URL = 'http://localhost:3001';
    process.env.CRM_API_URL = 'http://localhost:5000';
    process.env.PAYMENT_PROVIDER = 'mock';
    mockedAssertCheckoutSnapshotStillCurrent.mockResolvedValue(undefined);
    (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockReset().mockResolvedValue(null);
    mockedEnsureCrmReservation.mockReset().mockImplementation(async (_order: any, attempt: any) => attempt);
    
    // ✅ ПРАВИЛЬНЫЙ МОК ДЛЯ REDIS
    mockRedis.get = jest.fn().mockResolvedValue(null);
    mockRedis.setex = jest.fn().mockResolvedValue(undefined);
    mockRedis.del = jest.fn().mockResolvedValue(1);
  });

  // ============================================================
  // ТЕСТОВЫЙ РЕЖИМ
  // ============================================================
  describe('Test Mode', () => {
    describe('createPayment', () => {
      it('should create payment and return payment URL (test mode)', async () => {
        const mockOrder = {
          id: 'order-1',
          total: 1000,
          items: [{ name: 'Product', quantity: 1, price: 1000 }],
          guestEmail: 'test@example.com',
          guestPhone: '+79999999999',
          orderNumber: 'ORDER-001',
          status: 'pending',
        };

        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

        const result = await createPayment('order-1', 'http://localhost:3001/success');

        expect(result).toHaveProperty('paymentId');
        expect(result.paymentId).toMatch(/^mock_/);
        expect(result).toHaveProperty('paymentUrl');
        expect(result).toHaveProperty('status', 'pending');
      });

      it('should throw error if order not found', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(createPayment('order-1', 'http://localhost:3001/success')).rejects.toThrow(
          'Заказ не найден'
        );
      });

      it('should throw error if order already paid', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
          id: 'order-1',
          status: 'paid',
        });

        await expect(createPayment('order-1', 'http://localhost:3001/success')).rejects.toThrow(
          'Заказ уже оплачен'
        );
      });

      it('does not start a payment while cancellation is requested', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
          id: 'order-1', total: 1000, items: [], status: 'pending',
          cancellationState: 'requested', paymentId: null,
        });

        await expect(createPayment('order-1', 'http://localhost:3001/success'))
          .rejects.toThrow('Оплата недоступна во время отмены заказа');
        expect(mockedAssertCheckoutSnapshotStillCurrent).not.toHaveBeenCalled();
        expect(mockedEnsureCrmReservation).not.toHaveBeenCalled();
        expect(mockAxios.post).not.toHaveBeenCalled();
      });

      it('should not create payment when inventory changed after order creation', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
          id: 'order-1',
          total: 1000,
          items: [{ productId: '1', name: 'Product', quantity: 1, price: 1000 }],
          status: 'pending',
          paymentId: null,
        });
        mockedAssertCheckoutSnapshotStillCurrent.mockRejectedValue(new CheckoutInventoryError(
          'Недостаточно товара',
          409,
          'INSUFFICIENT_STOCK',
        ));

        await expect(createPayment('order-1', 'http://localhost:3001/success'))
          .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 });
        expect(mockPrisma.order.update).not.toHaveBeenCalled();
      });

      it('reuses an existing pending payment without rechecking free inventory', async () => {
        process.env.PAYMENT_PROVIDER = 'yookassa';
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
          id: 'order-1',
          total: 1000,
          items: [{ productId: '1', name: 'Product', quantity: 1, price: 1000 }],
          status: 'pending',
          paymentId: 'payment-1',
        });
        mockedAssertCheckoutSnapshotStillCurrent.mockRejectedValue(new CheckoutInventoryError(
          'Цена изменилась',
          409,
          'ORDER_PRICE_CHANGED',
        ));

        mockAxios.get.mockResolvedValueOnce({ data: {
          id: 'payment-1', status: 'pending', confirmation: { confirmation_url: 'https://provider.test/pay' },
        } });
        await expect(createPayment('order-1', 'http://localhost:3001/success'))
          .resolves.toMatchObject({ paymentId: 'payment-1', idempotent: true });
        expect(mockedAssertCheckoutSnapshotStillCurrent).not.toHaveBeenCalled();
        expect(mockAxios.post).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // БОЕВОЙ РЕЖИМ (PRODUCTION)
  // ============================================================
  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.PAYMENT_PROVIDER = 'yookassa';
      process.env.YOO_KASSA_SHOP_ID = 'real-shop-id';
      process.env.YOO_KASSA_SECRET_KEY = 'real-secret-key';
    });

    describe('createPayment', () => {
      // ✅ ИСПРАВЛЕНО: УБРАН ДУБЛИРУЮЩИЙСЯ id
      const mockOrder = {
        id: 'order-1',
        total: 1000,
        items: [
          { name: 'Product 1', quantity: 2, price: 400 },
          { name: 'Product 2', quantity: 1, price: 200 },
        ],
        guestEmail: 'test@example.com',
        guestPhone: '+79999999999',
        orderNumber: 'ORDER-001',
        status: 'pending',
        deliveryMethod: 'courier',
        deliveryAddress: 'г. Иркутск, ул. Тестовая 1',
        crmOrderId: null,
        guestName: 'Test User',
        comment: 'Test comment',
        userId: 'user-1',
      };

      it('should create payment in production mode', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

        const mockPaymentResponse = {
          data: {
            id: 'pay-prod-123',
            status: 'pending',
            confirmation: {
              confirmation_url: 'https://pay.yookassa.ru/confirm-123',
            },
          },
        };

        mockAxios.post.mockResolvedValue(mockPaymentResponse);
        (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, paymentId: 'pay-prod-123' });

        const result = await createPayment('order-1', 'http://localhost:3001/success');

        expect(result).toHaveProperty('paymentId', 'pay-prod-123');
        expect(result).toHaveProperty('paymentUrl', 'https://pay.yookassa.ru/confirm-123');
        expect(result).toHaveProperty('status', 'pending');
        expect(mockAxios.post).toHaveBeenCalled();
      });

      it('should create payment with delivery fee', async () => {
        const orderWithDelivery = {
          ...mockOrder,
          deliveryMethod: 'courier',
        };
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithDelivery);

        mockAxios.post.mockResolvedValue({
          data: {
            id: 'pay-prod-456',
            status: 'pending',
            confirmation: { confirmation_url: 'https://pay.yookassa.ru/confirm-456' },
          },
        });

        await createPayment('order-1', 'http://localhost:3001/success');

        expect(mockAxios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            receipt: expect.objectContaining({
              items: expect.arrayContaining([
                expect.objectContaining({ description: 'Доставка' }),
              ]),
            }),
          }),
          expect.any(Object)
        );
      });

      it('should handle YooKassa API error', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

        const apiError = {
          response: {
            data: { description: 'Недостаточно средств на карте' },
            status: 400,
          },
        };
        mockAxios.post.mockRejectedValue(apiError);

        await expect(createPayment('order-1', 'http://localhost:3001/success')).rejects.toThrow(
          'Ошибка платёжного провайдера'
        );
      });

      it('should handle unknown API error', async () => {
        (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

        mockAxios.post.mockRejectedValue(new Error('Network error'));

        await expect(createPayment('order-1', 'http://localhost:3001/success')).rejects.toThrow(
          'Ошибка создания платежа'
        );
      });
    });

    describe('getPaymentStatus', () => {
      it('should get payment status from YooKassa', async () => {
        const mockStatusResponse = {
          data: {
            id: 'pay-prod-123',
            status: 'succeeded',
            amount: { value: '1000.00', currency: 'RUB' },
          },
        };

        mockAxios.get.mockResolvedValue(mockStatusResponse);

        const result = await getPaymentStatus('pay-prod-123');

        expect(result).toEqual(mockStatusResponse.data);
        expect(mockAxios.get).toHaveBeenCalled();
      });

      it('should throw error if payment not found', async () => {
        mockAxios.get.mockRejectedValue(new Error('Payment not found'));

        await expect(getPaymentStatus('pay-prod-999')).rejects.toThrow(
          'Ошибка получения статуса платежа'
        );
      });
    });
  });

  // ============================================================
  // WEBHOOK ОБРАБОТКА
  // ============================================================
  describe('Webhook Handling', () => {
    const mockOrder = {
      id: 'order-1',
      total: 1000,
      items: [{ name: 'Product', quantity: 1, price: 1000 }],
      status: 'pending',
      guestName: 'Test User',
      guestEmail: 'test@example.com',
      guestPhone: '+79999999999',
      deliveryAddress: 'г. Иркутск',
      comment: '',
      userId: 'user-1',
      orderNumber: 'ORDER-001',
      crmOrderId: null,
    };

    it('should handle successful payment webhook', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'succeeded',
          metadata: { orderId: 'order-1' },
        },
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'paid' });
      (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.cart.update as jest.Mock).mockResolvedValue({});
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn().mockResolvedValue(undefined);
      mockRedis.del = jest.fn().mockResolvedValue(1);

      const result = await handlePaymentWebhook(event);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('status', 'paid');
    });

    it('should handle canceled payment webhook', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'canceled',
          metadata: { orderId: 'order-1' },
        },
      };

      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'cancelled' });
      (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'cancelled' });

      const result = await handlePaymentWebhook(event);

      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('status', 'canceled');
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      expect((mockPrisma as any).$queryRaw).toHaveBeenCalled();
    });

    it('keeps a cancellation-after-CRM-success conflict durable and guarded', async () => {
      const event = {
        object: { id: 'pay-123', status: 'canceled', metadata: { orderId: 'order-1' } },
      };
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder, status: 'confirmed', crmOrderId: 'crm-1',
      });
      (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'attempt-1', status: 'succeeded', providerPaymentId: 'pay-123',
      });
      (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});

      await expect(handlePaymentWebhook(event)).rejects.toThrow('PAYMENT_CANCELLATION_CONFLICT');
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ lastError: expect.stringContaining('PAYMENT_CANCELLATION_CONFLICT') }),
      }));
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('should handle webhook without metadata', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'succeeded',
        },
      };

      await expect(handlePaymentWebhook(event)).rejects.toThrow('Невалидный webhook');
    });

    it('should handle webhook without orderId', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'succeeded',
          metadata: {},
        },
      };

      await expect(handlePaymentWebhook(event)).rejects.toThrow('Нет orderId в metadata');
    });

    it('should handle unknown payment status', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'waiting_for_capture',
          metadata: { orderId: 'order-1' },
        },
      };

      const result = await handlePaymentWebhook(event);

      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('status', 'waiting_for_capture');
    });

    it('does not trust Redis processed marker over durable PostgreSQL state', async () => {
      const event = {
        object: {
          id: 'pay-123',
          status: 'succeeded',
          metadata: { orderId: 'order-1' },
        },
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'paid',
        crmOrderId: 'crm-123',
      });
      mockRedis.get = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('true');

      const result = await handlePaymentWebhook(event);

      expect(result).toHaveProperty('status', 'paid');
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'order-1' },
      }));
    });
  });

  // ============================================================
  // HANDLE PAYMENT SUCCESS
  // ============================================================
  describe('handlePaymentSuccess', () => {
    const mockOrder = {
      id: 'order-1',
      total: 1000,
      items: [{ name: 'Product', quantity: 1, price: 1000 }],
      status: 'pending',
      guestName: 'Test User',
      guestEmail: 'test@example.com',
      guestPhone: '+79999999999',
      deliveryAddress: 'г. Иркутск',
      comment: '',
      userId: 'user-1',
      orderNumber: 'ORDER-001',
      crmOrderId: null,
    };

    it('should process payment success and update order', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'paid' });
      (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.cart.update as jest.Mock).mockResolvedValue({});
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn().mockResolvedValue(undefined);
      mockRedis.del = jest.fn().mockResolvedValue(1);

      const result = await handlePaymentSuccess('order-1');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'paid');
      expect(mockPrisma.order.updateMany).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockedEnsureCrmCreateOutboxEvent).toHaveBeenCalled();
      expect(mockPrisma.cart.update).toHaveBeenCalled();
    });

    it('does not acknowledge an ephemeral Redis processing lock', async () => {
      mockRedis.get = jest.fn().mockResolvedValue('true');

      const result = await handlePaymentSuccess('order-1');

      expect(result).toHaveProperty('status', 'paid');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('repairs durable processing even when Redis says already processed', async () => {
      mockRedis.get = jest.fn()
        .mockResolvedValueOnce(null)  // lockKey
        .mockResolvedValueOnce('true'); // processedKey

      const result = await handlePaymentSuccess('order-1');

      expect(result).toHaveProperty('status', 'paid');
      expect(mockedEnsureCrmCreateOutboxEvent).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(null);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(handlePaymentSuccess('order-1')).rejects.toThrow('Заказ order-1 не найден');
    });

    it('should skip if order already paid and has crmOrderId', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(null);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'paid',
        crmOrderId: 'crm-123',
      });

      const result = await handlePaymentSuccess('order-1');

      expect(result).toHaveProperty('alreadyProcessed', true);
    });

    it('activates durable reconciliation for duplicate success after CRM exhaustion', async () => {
      const immutableOrderData = {
        contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1',
        paidAmountMinor: 100_000, currency: 'RUB', items: [],
      };
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockOrder,
        status: 'crm_failed',
        paymentId: 'payment-1',
        paymentAttempts: [{
          id: 'attempt-1', status: 'compensation_required', providerPaymentId: 'payment-1',
          reservationId: 'reservation-1', amountMinor: 100_000, currency: 'RUB',
        }],
      });
      (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'attempt-1', status: 'compensation_required', providerPaymentId: 'payment-1',
        reservationId: 'reservation-1', amountMinor: 100_000, currency: 'RUB',
      });
      (mockPrisma.outboxEvent.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
        payload: { orderId: 'order-1', orderData: immutableOrderData },
      });

      const result = await handlePaymentSuccess('order-1');

      expect(result).toEqual(expect.objectContaining({
        status: 'paid', alreadyProcessed: true, compensationRequired: true,
      }));
      expect(mockedEnsurePaymentReconciliationEvent).toHaveBeenCalledWith(
        mockPrisma, 'order-1', 'payment-1', immutableOrderData,
      );
      expect(mockedDispatchPaymentReconciliationEvent).toHaveBeenCalledWith('reconciliation-event');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect((mockPrisma as any).$queryRaw).toHaveBeenCalled();
    });

    it('reserves stock before fulfilling a payment that was pending during rollout', async () => {
      const legacyAttempt = {
        id: 'legacy_order-1', providerPaymentId: 'pay-legacy', reservationId: null,
        amountMinor: 100_000, currency: 'RUB',
      };
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        paymentId: 'pay-legacy',
        paymentAttempts: [legacyAttempt],
      });
      mockedEnsureCrmReservation.mockResolvedValueOnce({
        ...legacyAttempt,
        reservationId: 'reservation-legacy',
      });
      (mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.cart.update as jest.Mock).mockResolvedValue({});

      await handlePaymentSuccess('order-1');

      expect(mockedEnsureCrmReservation).toHaveBeenCalled();
      expect(mockedEnsureCrmCreateOutboxEvent).toHaveBeenCalledWith(
        expect.anything(),
        'order-1',
        expect.objectContaining({
          contractVersion: 1,
          reservationId: 'reservation-legacy',
          paymentId: 'pay-legacy',
        }),
      );
    });
  });

  // ============================================================
  // RESEND ORDER TO CRM
  // ============================================================
  describe('resendOrderToCRM', () => {
    const mockOrder = {
      id: 'order-1',
      total: 1000,
      items: [{ productId: '1', quantity: 2, price: 500 }],
      status: 'paid',
      guestName: 'Test User',
      guestPhone: '+79999999999',
      guestEmail: 'test@example.com',
      deliveryAddress: 'г. Иркутск',
      comment: '',
      orderNumber: 'ORDER-001',
      crmOrderId: null,
      deliveryMethod: 'courier',
    };

    it('should resend order to CRM', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'attempt-1', providerPaymentId: 'payment-1', reservationId: 'reservation-1',
        status: 'compensation_required', amountMinor: 100_000, currency: 'RUB',
      });
      (mockPrisma.outboxEvent.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ payload: { orderData: {
          contractVersion: 1, reservationId: 'reservation-1', paymentId: 'payment-1',
        } } });

      const result = await resendOrderToCRM('order-1');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('queued', true);
      expect(mockAxios.post).not.toHaveBeenCalled();
      expect(mockedEnsurePaymentReconciliationEvent).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resendOrderToCRM('order-1')).rejects.toThrow('Заказ order-1 не найден');
    });

    it('should throw error if order already has crmOrderId', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        crmOrderId: 'crm-123',
      });

      await expect(resendOrderToCRM('order-1')).rejects.toThrow(
        'Заказ order-1 уже отправлен в CRM (crmOrderId: crm-123)'
      );
    });

    it('should throw error if order not paid', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'pending',
      });

      await expect(resendOrderToCRM('order-1')).rejects.toThrow(
        'Заказ order-1 не оплачен (статус: pending)'
      );
    });

    it('should reject retry without a durable reservation', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.paymentAttempt.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resendOrderToCRM('order-1')).rejects.toThrow('durable payment reservation');
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });
});
