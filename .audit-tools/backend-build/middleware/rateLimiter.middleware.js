"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRateLimitStatus = exports.orderLimiter = exports.apiLimiter = exports.verificationLimiter = exports.authLimiter = exports.globalLimiter = void 0;
// backend/src/middleware/rateLimit.middleware.ts
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Глобальный лимит для всех запросов (защита от DDoS)
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 минута
    max: 500,
    message: { error: 'Слишком много запросов, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});
// Строгий лимит для авторизации (защита от брутфорса)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.verificationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { code: 'VERIFICATION_RATE_LIMITED', error: 'Слишком много попыток. Попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Лимит для API запросов
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Слишком много запросов, подождите немного' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket.remoteAddress ||
            'unknown';
    }
});
// Супер строгий лимит для создания заказов
exports.orderLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Слишком много заказов. Подождите немного' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket.remoteAddress ||
            'unknown';
    }
});
const logRateLimitStatus = () => {
    console.log('✅ Rate limiting configured');
};
exports.logRateLimitStatus = logRateLimitStatus;
//# sourceMappingURL=rateLimiter.middleware.js.map