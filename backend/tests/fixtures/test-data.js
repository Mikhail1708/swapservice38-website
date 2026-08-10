"use strict";
// backend/tests/fixtures/test-data.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTestData = exports.createTestArticle = exports.createTestCart = exports.createTestOrder = exports.createTestAdmin = exports.createTestUser = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================================
// ФАБРИКИ ДЛЯ ТЕСТОВЫХ ДАННЫХ
// ============================================================
const createTestUser = async (data = {}) => {
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
exports.createTestUser = createTestUser;
const createTestAdmin = async (data = {}) => {
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
exports.createTestAdmin = createTestAdmin;
const createTestOrder = async (userId, data = {}) => {
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
exports.createTestOrder = createTestOrder;
const createTestCart = async (userId, items = []) => {
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
exports.createTestCart = createTestCart;
const createTestArticle = async (authorId, data = {}) => {
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
exports.createTestArticle = createTestArticle;
// ============================================================
// ОЧИСТКА ТЕСТОВЫХ ДАННЫХ
// ============================================================
const cleanupTestData = async () => {
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
exports.cleanupTestData = cleanupTestData;
//# sourceMappingURL=test-data.js.map