// backend/tests/integration/order.integration.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Order Integration', () => {
  let authToken: string;
  let userId: string;
  let cartId: string;

  beforeEach(async () => {
    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        email: `order-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        isVerified: true,
      },
    });
    userId = user.id;

    // Создаём корзину с товарами
    const cart = await prisma.cart.create({
      data: {
        userId: userId,
        items: [
          {
            productId: '149',
            name: 'Test Product',
            price: 15000,
            quantity: 2,
            image: '/images/test.jpg',
          },
        ],
      },
    });
    cartId = cart.id;

    // Генерируем токен
    const token = require('jsonwebtoken').sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '7d' }
    );
    authToken = token;
  });

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cart.delete({ where: { id: cartId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================
  // ЗАКАЗЫ
  // ============================================================
  describe('Order Endpoints', () => {
    it('should create order from cart', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Cookie', [`token=${authToken}`])
        .send({
          client: {
            firstName: 'Test',
            lastName: 'User',
            phone: '+79991234567',
            email: 'test@example.com',
            address: 'г. Иркутск, ул. Тестовая 1',
          },
          deliveryMethod: 'courier',
          deliveryAddress: 'г. Иркутск, ул. Тестовая 1',
          comment: 'Test comment',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('order');
      expect(response.body.order).toHaveProperty('id');
      expect(response.body.order).toHaveProperty('total');
      expect(response.body.order).toHaveProperty('status', 'pending');

      // Проверяем что заказ создан в БД
      const order = await prisma.order.findUnique({
        where: { id: response.body.order.id },
      });
      expect(order).toBeTruthy();
      expect(order?.userId).toBe(userId);
      expect(order?.status).toBe('pending');

      // Проверяем что корзина очищена
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });
      expect(cart?.items).toHaveLength(0);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          client: {
            firstName: 'Test',
            phone: '+79991234567',
          },
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 if cart is empty', async () => {
      // Очищаем корзину
      await prisma.cart.update({
        where: { id: cartId },
        data: { items: [] },
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Cookie', [`token=${authToken}`])
        .send({
          client: {
            firstName: 'Test',
            phone: '+79991234567',
          },
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Корзина пуста');
    });

    it('should get user orders', async () => {
      // Создаём заказ
      const order = await prisma.order.create({
        data: {
          userId: userId,
          guestName: 'Test User',
          guestPhone: '+79991234567',
          items: [{ productId: '149', name: 'Test', price: 15000, quantity: 1 }],
          total: 15000,
          status: 'pending',
          deliveryMethod: 'courier',
        },
      });

      const response = await request(app)
        .get('/api/orders')
        .set('Cookie', [`token=${authToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.orders.length).toBeGreaterThan(0);
    });

    it('should get single order by ID', async () => {
      const order = await prisma.order.create({
        data: {
          userId: userId,
          guestName: 'Test User',
          guestPhone: '+79991234567',
          items: [{ productId: '149', name: 'Test', price: 15000, quantity: 1 }],
          total: 15000,
          status: 'pending',
          deliveryMethod: 'courier',
        },
      });

      const response = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Cookie', [`token=${authToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('order');
      expect(response.body.order.id).toBe(order.id);
    });

    it('should return 404 if order not found', async () => {
      const response = await request(app)
        .get('/api/orders/999')
        .set('Cookie', [`token=${authToken}`]);

      expect(response.status).toBe(404);
    });

    it('should delete order if pending and within 12 hours', async () => {
      const order = await prisma.order.create({
        data: {
          userId: userId,
          guestName: 'Test User',
          guestPhone: '+79991234567',
          items: [{ productId: '149', name: 'Test', price: 15000, quantity: 1 }],
          total: 15000,
          status: 'pending',
          deliveryMethod: 'courier',
          createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 час назад
        },
      });

      const response = await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', [`token=${authToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should not delete order older than 12 hours', async () => {
      const order = await prisma.order.create({
        data: {
          userId: userId,
          guestName: 'Test User',
          guestPhone: '+79991234567',
          items: [{ productId: '149', name: 'Test', price: 15000, quantity: 1 }],
          total: 15000,
          status: 'pending',
          deliveryMethod: 'courier',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 13), // 13 часов назад
        },
      });

      const response = await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', [`token=${authToken}`]);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});