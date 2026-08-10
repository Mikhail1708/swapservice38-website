"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/integration/cart.integration.test.ts
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../../src/server");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
describe('Cart Integration', () => {
    let authToken;
    let userId;
    beforeEach(async () => {
        // Создаём тестового пользователя
        const user = await prisma.user.create({
            data: {
                email: 'cart-test@example.com',
                passwordHash: 'hashed',
                isVerified: true,
            },
        });
        userId = user.id;
        // Получаем токен
        const loginRes = await (0, supertest_1.default)(server_1.app)
            .post('/api/auth/login')
            .send({
            email: 'cart-test@example.com',
            password: 'Test1234!',
        });
        // Если логин не сработал, устанавливаем токен вручную
        const token = require('jsonwebtoken').sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '7d' });
        authToken = token;
    });
    afterEach(async () => {
        await prisma.cart.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });
    // ============================================================
    // КОРЗИНА
    // ============================================================
    describe('Cart Endpoints', () => {
        it('should get empty cart for new user', async () => {
            const response = await (0, supertest_1.default)(server_1.app)
                .get('/api/cart')
                .set('Cookie', [`token=${authToken}`]);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('cart');
            expect(response.body.cart.items).toHaveLength(0);
            expect(response.body.cart.total).toBe(0);
        });
        it('should add item to cart', async () => {
            // Мокаем fetch для получения товара из CRM
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    id: 149,
                    name: 'Test Product',
                    price: 15000,
                    stock: 10,
                    images: [],
                }),
            });
            global.fetch = mockFetch;
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/cart/add')
                .set('Cookie', [`token=${authToken}`])
                .send({
                productId: '149',
                quantity: 2,
            });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('cart');
            expect(response.body.cart.items).toHaveLength(1);
            expect(response.body.cart.items[0].productId).toBe('149');
            expect(response.body.cart.items[0].quantity).toBe(2);
            // Проверяем что корзина сохранилась в БД
            const cart = await prisma.cart.findUnique({
                where: { userId },
            });
            expect(cart).toBeTruthy();
            expect(cart?.items).toHaveLength(1);
        });
        it('should update item quantity in cart', async () => {
            // Сначала добавляем товар
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    id: 149,
                    name: 'Test Product',
                    price: 15000,
                    stock: 10,
                    images: [],
                }),
            });
            global.fetch = mockFetch;
            await (0, supertest_1.default)(server_1.app)
                .post('/api/cart/add')
                .set('Cookie', [`token=${authToken}`])
                .send({ productId: '149', quantity: 1 });
            // Обновляем количество
            const response = await (0, supertest_1.default)(server_1.app)
                .put('/api/cart/update')
                .set('Cookie', [`token=${authToken}`])
                .send({
                productId: '149',
                quantity: 3,
            });
            expect(response.status).toBe(200);
            expect(response.body.cart.items[0].quantity).toBe(3);
        });
        it('should remove item from cart when quantity is 0', async () => {
            // Добавляем товар
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    id: 149,
                    name: 'Test Product',
                    price: 15000,
                    stock: 10,
                    images: [],
                }),
            });
            global.fetch = mockFetch;
            await (0, supertest_1.default)(server_1.app)
                .post('/api/cart/add')
                .set('Cookie', [`token=${authToken}`])
                .send({ productId: '149', quantity: 2 });
            // Удаляем товар (quantity = 0)
            const response = await (0, supertest_1.default)(server_1.app)
                .put('/api/cart/update')
                .set('Cookie', [`token=${authToken}`])
                .send({
                productId: '149',
                quantity: 0,
            });
            expect(response.status).toBe(200);
            expect(response.body.cart.items).toHaveLength(0);
        });
        it('should clear cart', async () => {
            // Добавляем товары
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    id: 149,
                    name: 'Test Product',
                    price: 15000,
                    stock: 10,
                    images: [],
                }),
            });
            global.fetch = mockFetch;
            await (0, supertest_1.default)(server_1.app)
                .post('/api/cart/add')
                .set('Cookie', [`token=${authToken}`])
                .send({ productId: '149', quantity: 2 });
            // Очищаем корзину
            const response = await (0, supertest_1.default)(server_1.app)
                .delete('/api/cart/clear')
                .set('Cookie', [`token=${authToken}`]);
            expect(response.status).toBe(200);
            expect(response.body.cart.items).toHaveLength(0);
            expect(response.body.cart.total).toBe(0);
        });
        it('should handle guest cart', async () => {
            // Запрос без токена — создаётся guestId
            const response = await (0, supertest_1.default)(server_1.app)
                .get('/api/cart');
            expect(response.status).toBe(200);
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.body).toHaveProperty('cart');
        });
    });
});
//# sourceMappingURL=cart.integration.test.js.map