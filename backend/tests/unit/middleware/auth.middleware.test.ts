// backend/tests/unit/middleware/auth.middleware.test.ts
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, requireAuth } from '../../../src/middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { credentialVersion } from '../../../src/utils/credentialVersion';

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
          passwordHash: 'current-password-hash',
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

  it('should reject a protected request without a token', async () => {
    const req = createRequest('/api/auth/me');
    const res = createResponse();

    await requireAuth(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject an invalid token instead of falling through', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });
    const req = createRequest('/api/auth/me', {}, { authorization: 'Bearer invalid-token' });
    const res = createResponse();

    await requireAuth(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should fail closed when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    const req = createRequest('/api/auth/me', { token: 'some-token' });
    const res = createResponse();

    await requireAuth(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept a protected request with a valid token', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: '1', cv: credentialVersion('current-password-hash') });
    const req = createRequest('/api/auth/me', { token: 'valid-token' });
    const res = createResponse();

    await requireAuth(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((req as any).user).toEqual(expect.objectContaining({ id: '1' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('invalidates a session after the stored password hash changes', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: '1', cv: credentialVersion('old-password-hash') });
    const req = createRequest('/api/auth/me', { token: 'old-session' });
    const res = createResponse();

    await requireAuth(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
