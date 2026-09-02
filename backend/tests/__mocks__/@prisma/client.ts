// backend/tests/__mocks__/@prisma/client.ts

const mockPrisma = {
  user: {
    create: jest.fn().mockResolvedValue({ id: 'test-id', email: 'test@example.com', isVerified: true, role: 'admin' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'test-id', email: 'test@example.com', isVerified: true, role: 'admin' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'test-id', email: 'test@example.com' }), // ✅ ДОБАВЛЯЕМ
    update: jest.fn().mockResolvedValue({ id: 'test-id' }),
    delete: jest.fn().mockResolvedValue({ id: 'test-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  },
  order: {
    create: jest.fn().mockResolvedValue({ id: 'order-id', status: 'pending', total: 15000 }),
    findUnique: jest.fn().mockResolvedValue({ id: 'order-id', status: 'pending' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'order-id', status: 'pending' }), // ✅ ДОБАВЛЯЕМ
    update: jest.fn().mockResolvedValue({ id: 'order-id', status: 'paid' }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({ id: 'order-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  },
  paymentAttempt: {
    create: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  outboxEvent: {
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  cart: {
    create: jest.fn().mockResolvedValue({ id: 'cart-id', items: [] }),
    findUnique: jest.fn().mockResolvedValue({ id: 'cart-id', items: [] }),
    findFirst: jest.fn().mockResolvedValue({ id: 'cart-id', items: [] }), // ✅ ДОБАВЛЯЕМ
    update: jest.fn().mockResolvedValue({ id: 'cart-id', items: [] }),
    delete: jest.fn().mockResolvedValue({ id: 'cart-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  article: {
    create: jest.fn().mockResolvedValue({ id: 'article-id', title: 'Test Article', slug: 'test-article' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'article-id', title: 'Test Article' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'article-id', title: 'Test Article' }), // ✅ ДОБАВЛЯЕМ
    update: jest.fn().mockResolvedValue({ id: 'article-id' }),
    delete: jest.fn().mockResolvedValue({ id: 'article-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  },
  comment: {
    create: jest.fn().mockResolvedValue({ id: 'comment-id' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'comment-id' }), // ✅ ДОБАВЛЯЕМ
    delete: jest.fn().mockResolvedValue({ id: 'comment-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  like: {
    create: jest.fn().mockResolvedValue({ id: 'like-id' }),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null), // ✅ ДОБАВЛЯЕМ
    delete: jest.fn().mockResolvedValue({ id: 'like-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  service: {
    create: jest.fn().mockResolvedValue({ id: 'service-id' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'service-id' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'service-id' }), // ✅ ДОБАВЛЯЕМ
    update: jest.fn().mockResolvedValue({ id: 'service-id' }),
    delete: jest.fn().mockResolvedValue({ id: 'service-id' }),
  },
  setting: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null), // ✅ ДОБАВЛЯЕМ
    upsert: jest.fn().mockResolvedValue({ key: 'test', value: 'test' }),
  },
  $transaction: jest.fn().mockImplementation((operation) => (
    Array.isArray(operation) ? Promise.all(operation) : operation(mockPrisma)
  )),
  $queryRaw: jest.fn().mockResolvedValue([]),
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

export const PrismaClient = jest.fn(() => mockPrisma);
export const Prisma = {
  TransactionIsolationLevel: { Serializable: 'Serializable', ReadCommitted: 'ReadCommitted' },
};
export default mockPrisma;
