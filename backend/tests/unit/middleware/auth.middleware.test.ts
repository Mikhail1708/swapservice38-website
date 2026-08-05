// backend/tests/unit/middleware/auth.middleware.test.ts
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middleware/auth.middleware';
import jwt from 'jsonwebtoken';

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

const createRequest = (path: string, cookies: any = {}, headers: any = {}, method: string = 'GET'): Partial<Request> => {
  return {
    cookies,
    headers,
    method,
    path: path as any,
    originalUrl: path,
    ip: '127.0.0.1',
  };
};

const createResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('Auth Middleware (Сайт)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret';
  });

  it('should skip auth for public paths', async () => {
    const req = createRequest('/api/public/products');
    const res = createResponse();

    await authMiddleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should skip auth for health check', async () => {
    const req = createRequest('/api/health');
    const res = createResponse();

    await authMiddleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should skip auth for login', async () => {
    const req = createRequest('/api/auth/login');
    const res = createResponse();

    await authMiddleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should skip auth for products', async () => {
    const req = createRequest('/api/products');
    const res = createResponse();

    await authMiddleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});