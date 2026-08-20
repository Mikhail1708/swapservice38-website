import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import redis from '@config/redis';

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createLimiter = (scope: string, max: number, windowSeconds: number) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.ip is derived by Express from the socket and the explicitly configured
      // trusted-proxy hop count. Never trust X-Forwarded-For directly here.
      const ipKey = createHash('sha256').update(req.ip || req.socket.remoteAddress || 'unknown').digest('hex');
      const key = `rate-limit:password-reset:${scope}:${ipKey}`;
      const count = Number(await redis.eval(RATE_LIMIT_SCRIPT, 1, key, windowSeconds));

      if (count > max) {
        res.setHeader('Retry-After', String(windowSeconds));
        return res.status(429).json({
          error: 'Слишком много попыток. Попробуйте позже',
        });
      }
      return next();
    } catch (_error) {
      // Password-reset security must not fail open when Redis is unavailable.
      return res.status(503).json({
        error: 'Сервис временно недоступен. Попробуйте позже',
      });
    }
  };

const ipWindowSeconds = positiveInteger(process.env.PASSWORD_RESET_IP_WINDOW_SECONDS, 15 * 60);
export const passwordResetRequestLimiter = createLimiter(
  'request',
  positiveInteger(process.env.PASSWORD_RESET_IP_REQUEST_MAX, 5),
  ipWindowSeconds
);
export const passwordResetAttemptLimiter = createLimiter(
  'attempt',
  positiveInteger(process.env.PASSWORD_RESET_IP_ATTEMPT_MAX, 30),
  ipWindowSeconds
);
