// backend/tests/integration/auth.integration.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import { PrismaClient } from '@prisma/client';
import redis from '../../src/config/redis';

const prisma = new PrismaClient();

describe('Auth Integration', () => {
  beforeEach(async () => {
    // Очищаем тестовые данные
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } },
    });
    // Очищаем Redis
    await redis.flushall();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  // ============================================================
  // РЕГИСТРАЦИЯ
  // ============================================================
  describe('POST /api/auth/register', () => {
    it('should register a new user and send verification email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test1234!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Код отправлен на почту');

      // Проверяем что пользователь создан в БД
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(user).toBeTruthy();
      expect(user?.isVerified).toBe(false);
    });

    it('should return 400 if user already exists', async () => {
      // Создаём пользователя
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed',
          isVerified: true,
        },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // ВЕРИФИКАЦИЯ EMAIL
  // ============================================================
  describe('POST /api/auth/verify', () => {
    it('should verify user email with valid code', async () => {
      // Создаём пользователя
      const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    passwordHash: await require('bcrypt').hash('Test1234!', 10),
    isVerified: true, // ✅ ВАЖНО!
  },
});
      // Сохраняем код в Redis
      const code = '123456';
      await redis.setex(`verify:test@example.com`, 600, code);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          email: 'test@example.com',
          code: code,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email подтверждён');

      // Проверяем что пользователь верифицирован
      const updatedUser = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(updatedUser?.isVerified).toBe(true);
    });

    it('should return 400 with invalid code', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          email: 'test@example.com',
          code: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // ЛОГИН
  // ============================================================
  describe('POST /api/auth/login', () => {
    it('should login user and set JWT cookie', async () => {
      // Создаём пользователя
      const passwordHash = await require('bcrypt').hash('Test1234!', 10);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: passwordHash,
          isVerified: true,
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test1234!',
        });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should return 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});