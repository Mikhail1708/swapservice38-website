"use strict";
// backend/tests/__mocks__/config/redis.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRedis = void 0;
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
    defineCommand: jest.fn(),
    sendCommand: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    multi: jest.fn().mockReturnThis(),
    call: jest.fn().mockResolvedValue('OK'),
};
// Безопасные хелперы
exports.safeRedis = {
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
const redis = mockRedisClient;
exports.default = redis;
//# sourceMappingURL=redis.js.map