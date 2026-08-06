// backend/tests/integration/admin.integration.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Admin API Integration', () => {
  let adminToken: string;
  let managerToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Создаём админа
    const admin = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        role: 'admin',
        isVerified: true,
      },
    });
    adminId = admin.id;
    adminToken = require('jsonwebtoken').sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET || 'test_secret'
    );

    // Создаём менеджера
    const manager = await prisma.user.create({
      data: {
        email: `manager-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        role: 'manager',
        isVerified: true,
      },
    });
    managerToken = require('jsonwebtoken').sign(
      { id: manager.id, email: manager.email, role: 'manager' },
      process.env.JWT_SECRET || 'test_secret'
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'test.com' } } });
    await prisma.$disconnect();
  });

  // ============================================================
  // DASHBOARD
  // ============================================================
  describe('GET /api/admin/dashboard/stats', () => {
    it('should return dashboard stats for admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('charts');
      expect(response.body).toHaveProperty('recent');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // USERS
  // ============================================================
  describe('Admin Users Management', () => {
    let testUserId: string;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-user-${Date.now()}@test.com`,
          passwordHash: 'hashed',
          role: 'user',
          isVerified: true,
        },
      });
      testUserId = user.id;
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    });

    it('GET /api/admin/users - should list users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
    });

    it('GET /api/admin/users/:id - should get user by id', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id', testUserId);
    });

    it('POST /api/admin/users - should create user', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          email: `new-user-${Date.now()}@test.com`,
          password: 'Test1234!',
          firstName: 'New',
          lastName: 'User',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toHaveProperty('email');

      await prisma.user.delete({ where: { email: response.body.user.email } }).catch(() => {});
    });

    it('POST /api/admin/users - should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          email: `test-user-${Date.now()}@test.com`, // уже существует
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('PUT /api/admin/users/:id - should update user', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          role: 'user',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.firstName).toBe('Updated');
    });

    it('DELETE /api/admin/users/:id - should delete user', async () => {
      // Создаём временного пользователя для удаления
      const tempUser = await prisma.user.create({
        data: {
          email: `delete-me-${Date.now()}@test.com`,
          passwordHash: 'hashed',
          role: 'user',
          isVerified: true,
        },
      });

      const response = await request(app)
        .delete(`/api/admin/users/${tempUser.id}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      const deleted = await prisma.user.findUnique({ where: { id: tempUser.id } });
      expect(deleted).toBeNull();
    });

    it('POST /api/admin/users/:id/block - should block user', async () => {
      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/block`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('blockedAt');
      expect(response.body.user.blockedAt).not.toBeNull();
    });

    it('POST /api/admin/users/:id/unblock - should unblock user', async () => {
      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/unblock`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body.user.blockedAt).toBeNull();
    });

    it('should not allow manager to delete admin users', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${adminId}`)
        .set('Cookie', [`token=${managerToken}`]); // ✅ ИСПРАВЛЕНО

      // Менеджер не должен иметь прав на удаление админов
      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // ORDERS
  // ============================================================
  describe('Admin Orders Management', () => {
    let testOrderId: string;

    beforeAll(async () => {
      const order = await prisma.order.create({
        data: {
          userId: adminId,
          guestName: 'Test Order',
          guestPhone: '+79991234567',
          items: [{ productId: '1', name: 'Product', price: 1000, quantity: 1 }],
          total: 1000,
          status: 'pending',
          deliveryMethod: 'courier',
        },
      });
      testOrderId = order.id;
    });

    afterAll(async () => {
      await prisma.order.delete({ where: { id: testOrderId } }).catch(() => {});
    });

    it('GET /api/admin/orders - should list orders', async () => {
      const response = await request(app)
        .get('/api/admin/orders')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('total');
    });

    it('GET /api/admin/orders/:id - should get order by id', async () => {
      const response = await request(app)
        .get(`/api/admin/orders/${testOrderId}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body.order).toHaveProperty('id', testOrderId);
    });

    it('PATCH /api/admin/orders/:id/status - should update order status', async () => {
      const response = await request(app)
        .patch(`/api/admin/orders/${testOrderId}/status`)
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({ status: 'paid' });

      expect(response.status).toBe(200);
      expect(response.body.order).toHaveProperty('status', 'paid');
    });

    it('DELETE /api/admin/orders/:id - should delete order', async () => {
      // Создаём временный заказ
      const tempOrder = await prisma.order.create({
        data: {
          userId: adminId,
          guestName: 'Temp Order',
          guestPhone: '+79991234567',
          items: [{ productId: '1', name: 'Product', price: 1000, quantity: 1 }],
          total: 1000,
          status: 'pending',
          deliveryMethod: 'courier',
        },
      });

      const response = await request(app)
        .delete(`/api/admin/orders/${tempOrder.id}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // ARTICLES
  // ============================================================
  describe('Admin Articles Management', () => {
    let articleId: string;

    afterEach(async () => {
      if (articleId) {
        await prisma.article.delete({ where: { id: articleId } }).catch(() => {});
        articleId = '';
      }
    });

    it('POST /api/admin/articles - should create article', async () => {
      const response = await request(app)
        .post('/api/admin/articles')
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          title: 'Test Article',
          content: 'Test content',
          description: 'Test description',
          isPublished: true,
          tags: ['test', 'article'],
          type: 'swap',
        });

      expect(response.status).toBe(201);
      expect(response.body.article).toHaveProperty('title', 'Test Article');
      articleId = response.body.article.id;
    });

    it('GET /api/admin/articles - should list articles', async () => {
      const response = await request(app)
        .get('/api/admin/articles')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
    });

    it('GET /api/admin/articles/:id - should get article by id', async () => {
      // Создаём статью
      const article = await prisma.article.create({
        data: {
          slug: `test-article-${Date.now()}`,
          title: 'Test Article 2',
          content: 'Test content 2',
          description: 'Test description 2',
          isPublished: true,
          authorId: adminId,
          type: 'swap',
        },
      });

      const response = await request(app)
        .get(`/api/admin/articles/${article.id}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', article.id);

      await prisma.article.delete({ where: { id: article.id } });
    });

    it('PUT /api/admin/articles/:id - should update article', async () => {
      // Создаём статью
      const article = await prisma.article.create({
        data: {
          slug: `test-article-${Date.now()}`,
          title: 'Test Article 3',
          content: 'Test content 3',
          description: 'Test description 3',
          isPublished: true,
          authorId: adminId,
          type: 'swap',
        },
      });

      const response = await request(app)
        .put(`/api/admin/articles/${article.id}`)
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          title: 'Updated Title',
          content: 'Updated content',
        });

      expect(response.status).toBe(200);
      expect(response.body.article).toHaveProperty('title', 'Updated Title');

      await prisma.article.delete({ where: { id: article.id } });
    });

    it('DELETE /api/admin/articles/:id - should delete article', async () => {
      const article = await prisma.article.create({
        data: {
          slug: `test-article-${Date.now()}`,
          title: 'Test Article 4',
          content: 'Test content 4',
          description: 'Test description 4',
          isPublished: true,
          authorId: adminId,
          type: 'swap',
        },
      });

      const response = await request(app)
        .delete(`/api/admin/articles/${article.id}`)
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // ============================================================
  // SETTINGS
  // ============================================================
  describe('Admin Settings Management', () => {
    it('GET /api/admin/settings - should get settings', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('siteName');
      expect(response.body).toHaveProperty('contactPhone');
    });

    it('PUT /api/admin/settings - should update settings', async () => {
      const response = await request(app)
        .put('/api/admin/settings')
        .set('Cookie', [`token=${adminToken}`]) // ✅ ИСПРАВЛЕНО
        .send({
          siteName: 'Updated Site Name',
          contactPhone: '+7 (999) 123-45-67',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      // Проверяем что сохранилось
      const getResponse = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

      expect(getResponse.body.siteName).toBe('Updated Site Name');
    });
  });

  // ============================================================
  // PERMISSIONS
  // ============================================================
  describe('Admin Permissions', () => {
    it('should allow admin to access all endpoints', async () => {
      const endpoints = [
        '/api/admin/dashboard/stats',
        '/api/admin/users',
        '/api/admin/orders',
        '/api/admin/settings',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Cookie', [`token=${adminToken}`]); // ✅ ИСПРАВЛЕНО

        expect(response.status).not.toBe(403);
        expect(response.status).not.toBe(401);
      }
    });

    it('should allow manager to access some endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Cookie', [`token=${managerToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(200);
    });

    it('should block manager from admin-only endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', [`token=${managerToken}`]); // ✅ ИСПРАВЛЕНО

      expect(response.status).toBe(403);
    });
  });
});