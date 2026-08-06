// backend/tests/integration/payment.integration.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Payment Integration', () => {
  let authToken: string;
  let userId: string;
  let orderId: string;

  beforeAll(async () => {
    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        email: `payment-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        isVerified: true,
      },
    });
    userId = user.id;

    authToken = require('jsonwebtoken').sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'test_secret'
    );
  });

  beforeEach(async () => {
    // Создаём заказ для каждого теста
    const order = await prisma.order.create({
      data: {
        userId: userId,
        guestName: 'Payment Test',
        guestPhone: '+79991234567',
        guestEmail: 'payment-test@example.com',
        items: [{ productId: '149', name: 'Test Product', price: 15000, quantity: 1 }],
        total: 15000,
        status: 'pending',
        deliveryMethod: 'courier',
        deliveryAddress: 'г. Иркутск, ул. Тестовая 1',
      },
    });
    orderId = order.id;
  });

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ============================================================
  // CREATE PAYMENT
  // ============================================================
  describe('POST /api/payment/create', () => {
    it('should create payment for order', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({ orderId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('paymentId');
      expect(response.body).toHaveProperty('paymentUrl');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .send({ orderId });

      expect(response.status).toBe(401);
    });

    it('should return 400 if orderId is missing', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 if order not found', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({ orderId: 'non-existent-id' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if order already paid', async () => {
      // Обновляем заказ на paid
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid' },
      });

      const response = await request(app)
        .post('/api/payment/create')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({ orderId });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // CONFIRM PAYMENT
  // ============================================================
  describe('POST /api/payment/confirm', () => {
    it('should confirm payment for order', async () => {
      // В тестовом режиме paymentId начинается с test_
      const response = await request(app)
        .post('/api/payment/confirm')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          orderId,
          paymentId: `test_${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'paid');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/payment/confirm')
        .send({ orderId, paymentId: 'test-123' });

      expect(response.status).toBe(401);
    });

    it('should return 400 if orderId is missing', async () => {
      const response = await request(app)
        .post('/api/payment/confirm')
        .set('Cookie', [`token=${authToken}`]) // ✅ ИСПРАВЛЕНО
        .send({ paymentId: 'test-123' });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // PAYMENT WEBHOOK
  // ============================================================
  describe('POST /api/payment/webhook', () => {
    it('should handle payment webhook', async () => {
      const webhookPayload = {
        object: {
          id: `pay_${Date.now()}`,
          status: 'succeeded',
          metadata: {
            orderId: orderId,
          },
        },
      };

      const response = await request(app)
        .post('/api/payment/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle canceled payment webhook', async () => {
      const webhookPayload = {
        object: {
          id: `pay_${Date.now()}`,
          status: 'canceled',
          metadata: {
            orderId: orderId,
          },
        },
      };

      const response = await request(app)
        .post('/api/payment/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // PAYMENT STATUS
  // ============================================================
  describe('GET /api/payment/status/:paymentId', () => {
    it('should get payment status', async () => {
      const paymentId = `test_${Date.now()}`;

      const response = await request(app)
        .get(`/api/payment/status/${paymentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });
});