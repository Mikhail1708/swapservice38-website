"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const csrf_middleware_1 = __importStar(require("../../../src/middleware/csrf.middleware"));
const createRequest = (path, cookies = {}, headers = {}, body = {}, method = 'GET') => {
    return {
        cookies,
        headers,
        body,
        method,
        path: path,
        originalUrl: path,
        ip: '127.0.0.1',
    };
};
const createResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    return res;
};
const mockNext = jest.fn();
describe('CSRF Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'test';
    });
    describe('getCsrfToken', () => {
        it('should generate and return CSRF token', () => {
            const req = createRequest('/api/test');
            const res = createResponse();
            (0, csrf_middleware_1.getCsrfToken)(req, res);
            expect(res.cookie).toHaveBeenCalled();
            expect(res.cookie).toHaveBeenCalledWith('sessionId', expect.any(String), expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
            }));
        });
    });
    describe('csrfMiddleware', () => {
        it('should skip CSRF for GET requests', async () => {
            const req = createRequest('/api/test', {}, {}, {}, 'GET');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should skip CSRF for public paths (auth/login)', async () => {
            const req = createRequest('/api/auth/login', {}, {}, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should skip CSRF for public paths (products)', async () => {
            const req = createRequest('/api/products', {}, {}, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should skip CSRF for public paths (cart/add)', async () => {
            const req = createRequest('/api/cart/add', {}, {}, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should skip CSRF for public paths (orders)', async () => {
            const req = createRequest('/api/orders', {}, {}, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should return 403 if CSRF token is missing on protected path', async () => {
            const req = createRequest('/api/admin/users', {}, {}, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'CSRF токен отсутствует',
                code: 'CSRF_TOKEN_MISSING',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should return 403 if CSRF token is invalid', async () => {
            const req = createRequest('/api/admin/users', { 'session-id': 'session-123' }, { 'x-csrf-token': 'invalid-token' }, {}, 'POST');
            const res = createResponse();
            await (0, csrf_middleware_1.default)(req, res, mockNext);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Неверный CSRF токен',
                code: 'CSRF_TOKEN_INVALID',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=csrf.middleware.test.js.map