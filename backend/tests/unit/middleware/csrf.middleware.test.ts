// backend/tests/unit/middleware/csrf.middleware.test.ts
import { Request, Response, NextFunction } from 'express';
import csrfMiddleware, { getCsrfToken } from '../../../src/middleware/csrf.middleware';

const createRequest = (path: string, cookies: any = {}, headers: any = {}, body: any = {}, method: string = 'GET'): Partial<Request> => {
  return {
    cookies,
    headers,
    body,
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
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('CSRF Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('getCsrfToken', () => {
    it('should generate and return CSRF token', () => {
      const req = createRequest('/api/test') as Request;
      const res = createResponse() as Response;

      getCsrfToken(req, res);

      expect(res.cookie).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'sessionId',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        })
      );
    });
  });

  describe('csrfMiddleware', () => {
    it('should skip CSRF for GET requests', async () => {
      const req = createRequest('/api/test', {}, {}, {}, 'GET') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF for public paths (auth/login)', async () => {
      const req = createRequest('/api/auth/login', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should protect state-changing product paths', async () => {
      const req = createRequest('/api/products', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect cart mutations', async () => {
      const req = createRequest('/api/cart/add', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect order mutations', async () => {
      const req = createRequest('/api/orders', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect authenticated password changes', async () => {
      const req = createRequest('/api/auth/request-password-change', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should not exempt paths that only start like a public route', async () => {
      const req = createRequest('/api/auth/login/extra', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if CSRF token is missing on protected path', async () => {
      const req = createRequest('/api/admin/users', {}, {}, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF токен отсутствует',
        code: 'CSRF_TOKEN_MISSING',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if CSRF token is invalid', async () => {
      const req = createRequest('/api/admin/users', { 'session-id': 'session-123' }, { 'x-csrf-token': 'invalid-token' }, {}, 'POST') as Request;
      const res = createResponse() as Response;

      await csrfMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Неверный CSRF токен',
        code: 'CSRF_TOKEN_INVALID',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
