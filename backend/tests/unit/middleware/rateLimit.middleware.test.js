"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/middleware/rateLimit.middleware.test.ts
const rateLimiter_middleware_1 = require("../../../src/middleware/rateLimiter.middleware");
describe('Rate Limit Middleware', () => {
    it('globalLimiter should be defined', () => {
        expect(rateLimiter_middleware_1.globalLimiter).toBeDefined();
    });
    it('authLimiter should be defined', () => {
        expect(rateLimiter_middleware_1.authLimiter).toBeDefined();
    });
    it('apiLimiter should be defined', () => {
        expect(rateLimiter_middleware_1.apiLimiter).toBeDefined();
    });
    it('orderLimiter should be defined', () => {
        expect(rateLimiter_middleware_1.orderLimiter).toBeDefined();
    });
    // ✅ ПРОСТО ПРОВЕРЯЕМ ЧТО ОБЪЕКТЫ СУЩЕСТВУЮТ
    it('should have rate limiters configured', () => {
        // Проверяем что все лимитеры — это функции или объекты
        expect(typeof rateLimiter_middleware_1.globalLimiter).toBe('function');
        expect(typeof rateLimiter_middleware_1.authLimiter).toBe('function');
        expect(typeof rateLimiter_middleware_1.apiLimiter).toBe('function');
        expect(typeof rateLimiter_middleware_1.orderLimiter).toBe('function');
    });
});
//# sourceMappingURL=rateLimit.middleware.test.js.map