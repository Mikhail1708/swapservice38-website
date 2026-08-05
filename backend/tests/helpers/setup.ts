// Настройка окружения для тестов
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

// ✅ ПРАВИЛЬНЫЙ МОК ДЛЯ REDIS
jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(600),
    keys: jest.fn().mockResolvedValue([]),
    flushall: jest.fn().mockResolvedValue('OK'),
  },
  safeRedis: {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    setJson: jest.fn().mockResolvedValue('OK'),
    getJson: jest.fn().mockResolvedValue(null),
  },
}));

// ✅ ПРАВИЛЬНЫЙ МОК ДЛЯ EMAIL
jest.mock('../../src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangeEmail: jest.fn().mockResolvedValue(true),
  sendOrderConfirmationToCustomer: jest.fn().mockResolvedValue(true),
  sendOrderNotificationToManager: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Подавляем вывод логов в тестах
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});