"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/services/cart.service.test.ts
const cart_service_1 = require("../../../src/services/cart.service");
const client_1 = require("@prisma/client");
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        cart: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };
    return {
        PrismaClient: jest.fn(() => mockPrisma),
    };
});
const mockPrisma = new client_1.PrismaClient();
describe('Cart Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getCart', () => {
        it('should return existing cart for userId', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 2 }],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            const result = await (0, cart_service_1.getCart)('user-1', undefined);
            expect(result).toEqual(mockCart);
            expect(mockPrisma.cart.findFirst).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
            });
        });
        it('should create new cart if not exists', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(null);
            mockPrisma.cart.create.mockResolvedValue({
                id: 'cart-new',
                userId: null,
                guestId: 'new-guest',
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            const result = await (0, cart_service_1.getCart)(undefined, 'new-guest');
            expect(mockPrisma.cart.create).toHaveBeenCalled();
            expect(result).toHaveProperty('id', 'cart-new');
        });
    });
    describe('addToCart', () => {
        it('should add new item to cart', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockUpdatedCart = {
                ...mockCart,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 1, image: 'img.jpg' }],
            };
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.cart.update.mockResolvedValue(mockUpdatedCart);
            const result = await (0, cart_service_1.addToCart)('1', 'Product 1', 100, 1, 'img.jpg', 'user-1', undefined);
            expect(mockPrisma.cart.update).toHaveBeenCalled();
            expect(result.items).toHaveLength(1);
        });
        it('should increase quantity if product already exists', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 1, image: 'img.jpg' }],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockUpdatedCart = {
                ...mockCart,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 2, image: 'img.jpg' }],
            };
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.cart.update.mockResolvedValue(mockUpdatedCart);
            const result = await (0, cart_service_1.addToCart)('1', 'Product 1', 100, 1, 'img.jpg', 'user-1', undefined);
            expect(result.items[0].quantity).toBe(2);
        });
    });
    describe('updateCartItem', () => {
        it('should update quantity of existing item', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 1, image: 'img.jpg' }],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockUpdatedCart = {
                ...mockCart,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 3, image: 'img.jpg' }],
            };
            mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
            mockPrisma.cart.update.mockResolvedValue(mockUpdatedCart);
            const result = await (0, cart_service_1.updateCartItem)('cart-1', '1', 3);
            expect(result.items[0].quantity).toBe(3);
        });
        it('should remove item if quantity is 0', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 1, image: 'img.jpg' }],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockUpdatedCart = {
                ...mockCart,
                items: [],
            };
            mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
            mockPrisma.cart.update.mockResolvedValue(mockUpdatedCart);
            const result = await (0, cart_service_1.updateCartItem)('cart-1', '1', 0);
            expect(result.items).toHaveLength(0);
        });
        it('should throw error if cart not found', async () => {
            mockPrisma.cart.findUnique.mockResolvedValue(null);
            await expect((0, cart_service_1.updateCartItem)('cart-1', '1', 3)).rejects.toThrow('Корзина не найдена');
        });
    });
    describe('clearCart', () => {
        it('should clear all items from cart', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [{ productId: '1', name: 'Product 1', price: 100, quantity: 2, image: 'img.jpg' }],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockEmptyCart = {
                ...mockCart,
                items: [],
            };
            mockPrisma.cart.update.mockResolvedValue(mockEmptyCart);
            const result = await (0, cart_service_1.clearCart)('cart-1');
            expect(result.items).toHaveLength(0);
        });
    });
    describe('getCartWithTotal', () => {
        it('should return cart with calculated total', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [
                    { productId: '1', name: 'Product 1', price: 100, quantity: 2 },
                    { productId: '2', name: 'Product 2', price: 50, quantity: 3 },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            const result = await (0, cart_service_1.getCartWithTotal)('user-1', undefined);
            expect(result).toHaveProperty('total', 350);
            expect(result).toHaveProperty('itemsCount', 5);
        });
        it('should return empty cart with 0 total if no items', async () => {
            const mockCart = {
                id: 'cart-1',
                userId: 'user-1',
                guestId: null,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            const result = await (0, cart_service_1.getCartWithTotal)('user-1', undefined);
            expect(result.total).toBe(0);
            expect(result.itemsCount).toBe(0);
        });
    });
});
//# sourceMappingURL=cart.service.test.js.map