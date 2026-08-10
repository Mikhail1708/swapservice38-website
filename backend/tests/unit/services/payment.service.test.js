"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/services/payment.service.test.ts
const payment_service_1 = require("../../../src/services/payment.service");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../../../src/config/redis");
// ============================================================
// МОКИ
// ============================================================
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        cart: {
            update: jest.fn(),
        },
    };
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
const mockAxios = axios_1.default;
const mockPrisma = new client_1.PrismaClient();
const mockRedis = redis_1.safeRedis;
describe('Payment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.YOO_KASSA_SHOP_ID = 'test-shop';
        process.env.YOO_KASSA_SECRET_KEY = 'test-secret';
        process.env.CLIENT_URL = 'http://localhost:3001';
        process.env.CRM_API_URL = 'http://localhost:5000';
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
                mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
                const result = await (0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success');
                expect(result).toHaveProperty('paymentId');
                expect(result.paymentId).toMatch(/^test_/);
                expect(result).toHaveProperty('paymentUrl');
                expect(result).toHaveProperty('status', 'pending');
            });
            it('should throw error if order not found', async () => {
                mockPrisma.order.findUnique.mockResolvedValue(null);
                await expect((0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success')).rejects.toThrow('Заказ не найден');
            });
            it('should throw error if order already paid', async () => {
                mockPrisma.order.findUnique.mockResolvedValue({
                    id: 'order-1',
                    status: 'paid',
                });
                await expect((0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success')).rejects.toThrow('Заказ уже оплачен');
            });
        });
    });
    // ============================================================
    // БОЕВОЙ РЕЖИМ (PRODUCTION)
    // ============================================================
    describe('Production Mode', () => {
        beforeEach(() => {
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
                mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
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
                mockPrisma.order.update.mockResolvedValue({ ...mockOrder, paymentId: 'pay-prod-123' });
                const result = await (0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success');
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
                mockPrisma.order.findUnique.mockResolvedValue(orderWithDelivery);
                mockAxios.post.mockResolvedValue({
                    data: {
                        id: 'pay-prod-456',
                        status: 'pending',
                        confirmation: { confirmation_url: 'https://pay.yookassa.ru/confirm-456' },
                    },
                });
                await (0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success');
                expect(mockAxios.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                    receipt: expect.objectContaining({
                        items: expect.arrayContaining([
                            expect.objectContaining({ description: 'Доставка' }),
                        ]),
                    }),
                }), expect.any(Object));
            });
            it('should handle YooKassa API error', async () => {
                mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
                const apiError = {
                    response: {
                        data: { description: 'Недостаточно средств на карте' },
                        status: 400,
                    },
                };
                mockAxios.post.mockRejectedValue(apiError);
                await expect((0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success')).rejects.toThrow('Недостаточно средств на карте');
            });
            it('should handle unknown API error', async () => {
                mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
                mockAxios.post.mockRejectedValue(new Error('Network error'));
                await expect((0, payment_service_1.createPayment)('order-1', 'http://localhost:3001/success')).rejects.toThrow('Ошибка создания платежа');
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
                const result = await (0, payment_service_1.getPaymentStatus)('pay-prod-123');
                expect(result).toEqual(mockStatusResponse.data);
                expect(mockAxios.get).toHaveBeenCalled();
            });
            it('should throw error if payment not found', async () => {
                mockAxios.get.mockRejectedValue(new Error('Payment not found'));
                await expect((0, payment_service_1.getPaymentStatus)('pay-prod-999')).rejects.toThrow('Ошибка получения статуса платежа');
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
            mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
            mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: 'paid' });
            mockPrisma.cart.update.mockResolvedValue({});
            mockRedis.get = jest.fn().mockResolvedValue(null);
            mockRedis.setex = jest.fn().mockResolvedValue(undefined);
            mockRedis.del = jest.fn().mockResolvedValue(1);
            const result = await (0, payment_service_1.handlePaymentWebhook)(event);
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
            mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: 'cancelled' });
            const result = await (0, payment_service_1.handlePaymentWebhook)(event);
            expect(result).toHaveProperty('orderId', 'order-1');
            expect(result).toHaveProperty('status', 'cancelled');
            expect(mockPrisma.order.update).toHaveBeenCalled();
        });
        it('should handle webhook without metadata', async () => {
            const event = {
                object: {
                    id: 'pay-123',
                    status: 'succeeded',
                },
            };
            await expect((0, payment_service_1.handlePaymentWebhook)(event)).rejects.toThrow('Невалидный webhook');
        });
        it('should handle webhook without orderId', async () => {
            const event = {
                object: {
                    id: 'pay-123',
                    status: 'succeeded',
                    metadata: {},
                },
            };
            await expect((0, payment_service_1.handlePaymentWebhook)(event)).rejects.toThrow('Нет orderId в metadata');
        });
        it('should handle unknown payment status', async () => {
            const event = {
                object: {
                    id: 'pay-123',
                    status: 'waiting_for_capture',
                    metadata: { orderId: 'order-1' },
                },
            };
            const result = await (0, payment_service_1.handlePaymentWebhook)(event);
            expect(result).toHaveProperty('orderId', 'order-1');
            expect(result).toHaveProperty('status', 'waiting_for_capture');
        });
        it('should skip if order already processed', async () => {
            const event = {
                object: {
                    id: 'pay-123',
                    status: 'succeeded',
                    metadata: { orderId: 'order-1' },
                },
            };
            mockPrisma.order.findUnique.mockResolvedValue({
                ...mockOrder,
                status: 'paid',
                crmOrderId: 'crm-123',
            });
            mockRedis.get = jest.fn().mockResolvedValue('true');
            const result = await (0, payment_service_1.handlePaymentWebhook)(event);
            expect(result).toHaveProperty('alreadyProcessed', true);
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
            mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
            mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: 'paid' });
            mockPrisma.cart.update.mockResolvedValue({});
            mockRedis.get = jest.fn().mockResolvedValue(null);
            mockRedis.setex = jest.fn().mockResolvedValue(undefined);
            mockRedis.del = jest.fn().mockResolvedValue(1);
            const result = await (0, payment_service_1.handlePaymentSuccess)('order-1');
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('status', 'paid');
            expect(mockPrisma.order.update).toHaveBeenCalled();
            expect(mockPrisma.cart.update).toHaveBeenCalled();
        });
        it('should skip if order already processing', async () => {
            mockRedis.get = jest.fn().mockResolvedValue('true');
            const result = await (0, payment_service_1.handlePaymentSuccess)('order-1');
            expect(result).toHaveProperty('alreadyProcessing', true);
        });
        it('should skip if order already processed', async () => {
            mockRedis.get = jest.fn()
                .mockResolvedValueOnce(null) // lockKey
                .mockResolvedValueOnce('true'); // processedKey
            const result = await (0, payment_service_1.handlePaymentSuccess)('order-1');
            expect(result).toHaveProperty('alreadyProcessed', true);
        });
        it('should throw error if order not found', async () => {
            mockRedis.get = jest.fn().mockResolvedValue(null);
            mockPrisma.order.findUnique.mockResolvedValue(null);
            await expect((0, payment_service_1.handlePaymentSuccess)('order-1')).rejects.toThrow('Заказ order-1 не найден');
        });
        it('should skip if order already paid and has crmOrderId', async () => {
            mockRedis.get = jest.fn().mockResolvedValue(null);
            mockPrisma.order.findUnique.mockResolvedValue({
                ...mockOrder,
                status: 'paid',
                crmOrderId: 'crm-123',
            });
            const result = await (0, payment_service_1.handlePaymentSuccess)('order-1');
            expect(result).toHaveProperty('alreadyProcessed', true);
        });
    });
    // ============================================================
    // VERIFY WEBHOOK SIGNATURE
    // ============================================================
    describe('verifyWebhookSignature', () => {
        it('should return true for test mode', () => {
            const result = (0, payment_service_1.verifyWebhookSignature)('test-body', 'test-signature');
            expect(result).toBe(true);
        });
        it('should return false if signature missing', () => {
            const result = (0, payment_service_1.verifyWebhookSignature)('test-body', null);
            expect(result).toBe(false);
        });
        it('should return false if signature invalid', () => {
            process.env.YOO_KASSA_SECRET_KEY = 'real-secret';
            const result = (0, payment_service_1.verifyWebhookSignature)('test-body', 'invalid-signature');
            expect(result).toBe(false);
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
            mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
            const mockCrmResponse = {
                data: {
                    orderId: 12345,
                    documentNumber: 'ЗАКАЗ-2026-001',
                },
            };
            mockAxios.post.mockResolvedValue(mockCrmResponse);
            mockPrisma.order.update.mockResolvedValue({ ...mockOrder, crmOrderId: '12345' });
            const result = await (0, payment_service_1.resendOrderToCRM)('order-1');
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('crmOrderId', 12345);
            expect(result).toHaveProperty('documentNumber', 'ЗАКАЗ-2026-001');
            expect(mockAxios.post).toHaveBeenCalled();
        });
        it('should throw error if order not found', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);
            await expect((0, payment_service_1.resendOrderToCRM)('order-1')).rejects.toThrow('Заказ order-1 не найден');
        });
        it('should throw error if order already has crmOrderId', async () => {
            mockPrisma.order.findUnique.mockResolvedValue({
                ...mockOrder,
                crmOrderId: 'crm-123',
            });
            await expect((0, payment_service_1.resendOrderToCRM)('order-1')).rejects.toThrow('Заказ order-1 уже отправлен в CRM (crmOrderId: crm-123)');
        });
        it('should throw error if order not paid', async () => {
            mockPrisma.order.findUnique.mockResolvedValue({
                ...mockOrder,
                status: 'pending',
            });
            await expect((0, payment_service_1.resendOrderToCRM)('order-1')).rejects.toThrow('Заказ order-1 не оплачен (статус: pending)');
        });
        it('should handle CRM error', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
            mockAxios.post.mockRejectedValue(new Error('CRM unavailable'));
            await expect((0, payment_service_1.resendOrderToCRM)('order-1')).rejects.toThrow('CRM unavailable');
        });
    });
});
//# sourceMappingURL=payment.service.test.js.map