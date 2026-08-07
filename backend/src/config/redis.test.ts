// backend/src/config/redis.test.ts
// Это заглушка для тестов, которая заменяет реальный Redis

// Мок-клиент Redis для тестов
const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(600),
  flushall: jest.fn().mockResolvedValue('OK'),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn().mockReturnThis(),
  quit: jest.fn().mockResolvedValue('OK'),
  duplicate: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

const redis = mockRedisClient;
export default redis;

export const safeRedis = {
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(600),
  flushall: jest.fn().mockResolvedValue(undefined),
  setJson: jest.fn().mockResolvedValue(undefined),
  getJson: jest.fn().mockResolvedValue(null),
};