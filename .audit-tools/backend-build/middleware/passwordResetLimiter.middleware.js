"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetAttemptLimiter = exports.passwordResetRequestLimiter = void 0;
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../config/redis"));
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;
const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const createLimiter = (scope, max, windowSeconds) => async (req, res, next) => {
    try {
        // req.ip is derived by Express from the socket and the explicitly configured
        // trusted-proxy hop count. Never trust X-Forwarded-For directly here.
        const ipKey = (0, crypto_1.createHash)('sha256').update(req.ip || req.socket.remoteAddress || 'unknown').digest('hex');
        const key = `rate-limit:password-reset:${scope}:${ipKey}`;
        const count = Number(await redis_1.default.eval(RATE_LIMIT_SCRIPT, 1, key, windowSeconds));
        if (count > max) {
            res.setHeader('Retry-After', String(windowSeconds));
            return res.status(429).json({
                error: 'Слишком много попыток. Попробуйте позже',
            });
        }
        return next();
    }
    catch (_error) {
        // Password-reset security must not fail open when Redis is unavailable.
        return res.status(503).json({
            error: 'Сервис временно недоступен. Попробуйте позже',
        });
    }
};
const ipWindowSeconds = positiveInteger(process.env.PASSWORD_RESET_IP_WINDOW_SECONDS, 15 * 60);
exports.passwordResetRequestLimiter = createLimiter('request', positiveInteger(process.env.PASSWORD_RESET_IP_REQUEST_MAX, 5), ipWindowSeconds);
exports.passwordResetAttemptLimiter = createLimiter('attempt', positiveInteger(process.env.PASSWORD_RESET_IP_ATTEMPT_MAX, 30), ipWindowSeconds);
//# sourceMappingURL=passwordResetLimiter.middleware.js.map