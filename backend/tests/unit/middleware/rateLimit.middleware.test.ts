// backend/tests/unit/middleware/rateLimit.middleware.test.ts
import { globalLimiter, authLimiter, apiLimiter, orderLimiter } from '../../../src/middleware/rateLimiter.middleware';

describe('Rate Limit Middleware', () => {
  it('globalLimiter should be defined', () => {
    expect(globalLimiter).toBeDefined();
  });

  it('authLimiter should be defined', () => {
    expect(authLimiter).toBeDefined();
  });

  it('apiLimiter should be defined', () => {
    expect(apiLimiter).toBeDefined();
  });

  it('orderLimiter should be defined', () => {
    expect(orderLimiter).toBeDefined();
  });

  // ✅ ПРОСТО ПРОВЕРЯЕМ ЧТО ОБЪЕКТЫ СУЩЕСТВУЮТ
  it('should have rate limiters configured', () => {
    // Проверяем что все лимитеры — это функции или объекты
    expect(typeof globalLimiter).toBe('function');
    expect(typeof authLimiter).toBe('function');
    expect(typeof apiLimiter).toBe('function');
    expect(typeof orderLimiter).toBe('function');
  });
});