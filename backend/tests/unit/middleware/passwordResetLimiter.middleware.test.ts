import { NextFunction, Request, Response } from 'express';
import redis from '@config/redis';
import {
  passwordResetAttemptLimiter,
  passwordResetRequestLimiter,
} from '../../../src/middleware/passwordResetLimiter.middleware';

const mockRedis = redis as jest.Mocked<typeof redis>;

const response = () => {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  (res.json as jest.Mock).mockReturnValue(res);
  return res;
};

const request = (ip = '203.0.113.8') => ({
  ip,
  socket: { remoteAddress: '127.0.0.1' },
  headers: { 'x-forwarded-for': '198.51.100.99' },
}) as unknown as Request;

describe('Password reset endpoint limiters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows requests inside the Redis-backed limit', async () => {
    mockRedis.eval.mockResolvedValueOnce(5);
    const next = jest.fn() as NextFunction;
    await passwordResetRequestLimiter(request(), response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 429 after the request endpoint limit', async () => {
    mockRedis.eval.mockResolvedValueOnce(6);
    const res = response();
    const next = jest.fn() as NextFunction;
    await passwordResetRequestLimiter(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 429 after the shared verify/confirm IP limit', async () => {
    mockRedis.eval.mockResolvedValueOnce(31);
    const res = response();
    await passwordResetAttemptLimiter(request(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('fails closed when Redis is unavailable', async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error('Redis unavailable'));
    const res = response();
    const next = jest.fn() as NextFunction;
    await passwordResetAttemptLimiter(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('keys by Express req.ip and ignores a raw forwarded-for header', async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await passwordResetRequestLimiter(request('203.0.113.8'), response(), jest.fn());
    const key = String(mockRedis.eval.mock.calls[0][3]);
    expect(key).not.toContain('198.51.100.99');
  });
});

