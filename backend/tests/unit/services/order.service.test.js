"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const order_service_1 = require("../../../src/services/order.service");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        cart: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };
    return {
        PrismaClient: jest.fn(() => mockPrisma),
    };
});
jest.mock('axios');
const mockAxios = axios_1.default;
const mockPrisma = new client_1.PrismaClient();
describe('Order Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRM_API_URL = 'http://localhost:5000';
    });
    describe('getCartWithTotal', () => {
        it('should calculate total and items count', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                items: [
                    { productId: '1', price: 100, quantity: 2 },
                    { productId: '2', price: 50, quantity: 3 },
                ],
            };
            mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
            const result = await (0, order_service_1.getCartWithTotal)('user-1');
            expect(result.total).toBe(350);
            expect(result.itemsCount).toBe(5);
        });
    });
    describe('clearCart', () => {
        it('should clear cart items', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                items: [{ productId: '1', price: 100, quantity: 2 }],
            };
            mockPrisma.cart.update.mockResolvedValue({ ...mockCart, items: [] });
            const result = await (0, order_service_1.clearCart)('cart-1');
            expect(result.items).toHaveLength(0);
            expect(mockPrisma.cart.update).toHaveBeenCalledWith({
                where: { id: 'cart-1' },
                data: { items: [] },
            });
        });
    });
    describe('createOrderInCRM', () => {
        it('should send order to CRM and return response', async () => {
            const orderData = {
                items: [{ productId: 1, quantity: 2, price: 100 }],
                client: {
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+79999999999',
                    email: 'test@example.com',
                    address: 'г. Иркутск',
                },
                deliveryMethod: 'courier',
                deliveryAddress: 'г. Иркутск',
                comment: 'Test comment',
                source: 'website',
            };
            const mockResponse = {
                data: {
                    success: true,
                    orderId: 12345,
                    documentNumber: 'ЗАКАЗ-2026-001',
                    total: 200,
                },
            };
            mockAxios.post.mockResolvedValue(mockResponse);
            const result = await (0, order_service_1.createOrderInCRM)(orderData);
            expect(result).toEqual(mockResponse.data);
            expect(mockAxios.post).toHaveBeenCalledWith('http://localhost:5000/api/sale-documents/public', orderData, expect.objectContaining({ timeout: 15000 }));
        });
        it('should throw error on CRM failure', async () => {
            const orderData = {
                items: [{ productId: 1, quantity: 1 }],
                client: { firstName: 'Test', phone: '+79999999999' },
                deliveryMethod: 'courier',
                source: 'website',
            };
            mockAxios.post.mockRejectedValue(new Error('CRM unavailable'));
            await expect((0, order_service_1.createOrderInCRM)(orderData)).rejects.toThrow('Ошибка создания заказа в CRM');
        });
    });
    describe('getOrderStatusFromCRM', () => {
        it('should get order status from CRM', async () => {
            const mockResponse = {
                data: {
                    id: 12345,
                    orderStatus: 'paid',
                    documentNumber: 'ЗАКАЗ-2026-001',
                },
            };
            mockAxios.get.mockResolvedValue(mockResponse);
            const result = await (0, order_service_1.getOrderStatusFromCRM)(12345);
            expect(result).toEqual(mockResponse.data);
            expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:5000/api/sale-documents/12345/status', expect.objectContaining({ timeout: 5000 }));
        });
        it('should return unknown on error', async () => {
            mockAxios.get.mockRejectedValue(new Error('CRM unavailable'));
            const result = await (0, order_service_1.getOrderStatusFromCRM)(12345);
            expect(result).toEqual({ orderStatus: 'unknown' });
        });
    });
});
//# sourceMappingURL=order.service.test.js.map