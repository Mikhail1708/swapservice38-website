"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_middleware_1 = require("../../../src/middleware/auth.middleware");
jest.mock('jsonwebtoken');
jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => ({
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    id: '1',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+79991234567',
                    address: 'г. Иркутск',
                    role: 'user',
                    isVerified: true,
                    blockedAt: null,
                }),
            },
        })),
    };
});
const createRequest = (path, cookies = {}, headers = {}, method = 'GET') => {
    return {
        cookies,
        headers,
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
    return res;
};
const mockNext = jest.fn();
describe('Auth Middleware (Сайт)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test_secret';
    });
    it('should skip auth for public paths', async () => {
        const req = createRequest('/api/public/products');
        const res = createResponse();
        await (0, auth_middleware_1.authMiddleware)(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
    it('should skip auth for health check', async () => {
        const req = createRequest('/api/health');
        const res = createResponse();
        await (0, auth_middleware_1.authMiddleware)(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
    it('should skip auth for login', async () => {
        const req = createRequest('/api/auth/login');
        const res = createResponse();
        await (0, auth_middleware_1.authMiddleware)(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
    it('should skip auth for products', async () => {
        const req = createRequest('/api/products');
        const res = createResponse();
        await (0, auth_middleware_1.authMiddleware)(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=auth.middleware.test.js.map