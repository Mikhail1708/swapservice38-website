// backend/tests/fixtures/test-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// ФАБРИКИ ДЛЯ ТЕСТОВЫХ ДАННЫХ
// ============================================================

export const createTestUser = async (data: Partial<any> = {}) => {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      passwordHash: 'hashed_password',
      isVerified: true,
      role: 'user',
      ...data,
    },
  });
};

export const createTestAdmin = async (data: Partial<any> = {}) => {
  return prisma.user.create({
    data: {
      email: `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      passwordHash: 'hashed_password',
      isVerified: true,
      role: 'admin',
      ...data,
    },
  });
};

export const createTestOrder = async (userId: string, data: Partial<any> = {}) => {
  return prisma.order.create({
    data: {
      userId,
      guestName: 'Test User',
      guestPhone: '+79991234567',
      guestEmail: 'test@example.com',
      items: [
        {
          productId: '149',
          name: 'Test Product',
          price: 15000,
          quantity: 1,
          image: '/images/test.jpg',
        },
      ],
      total: 15000,
      status: 'pending',
      deliveryMethod: 'courier',
      deliveryAddress: 'г. Иркутск, ул. Тестовая 1',
      ...data,
    },
  });
};

export const createTestCart = async (userId: string, items: any[] = []) => {
  return prisma.cart.create({
    data: {
      userId,
      items: items.length > 0 ? items : [
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
};

export const createTestArticle = async (authorId: string, data: Partial<any> = {}) => {
  const slug = `test-article-${Date.now()}`;
  return prisma.article.create({
    data: {
      slug,
      title: 'Test Article',
      content: 'Test content',
      description: 'Test description',
      isPublished: true,
      authorId,
      type: 'swap',
      ...data,
    },
  });
};

// ============================================================
// ОЧИСТКА ТЕСТОВЫХ ДАННЫХ
// ============================================================

export const cleanupTestData = async () => {
  await prisma.articleTagRelation.deleteMany();
  await prisma.articleImage.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.article.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test',
      },
    },
  });
};