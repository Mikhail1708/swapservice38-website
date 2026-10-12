"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEmailVerificationCode = exports.issueEmailVerificationCode = exports.emailVerificationTiming = exports.generateEmailVerificationCode = void 0;
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../config/redis"));
const ISSUE_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
return 1
`;
const CHECK_SCRIPT = `
local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -2 end
local stored = redis.call('GET', KEYS[1])
if not stored then return -1 end
if stored == ARGV[1] then
  if ARGV[4] == '1' then redis.call('DEL', KEYS[1], KEYS[2]) end
  return 1
end
attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -2 end
return 0
`;
const keys = (userId) => ({
    code: `email-verification:${userId}:code`,
    attempts: `email-verification:${userId}:attempts`,
    cooldown: `email-verification:${userId}:cooldown`,
});
const generateEmailVerificationCode = () => (0, crypto_1.randomInt)(100000, 1000000).toString();
exports.generateEmailVerificationCode = generateEmailVerificationCode;
const emailVerificationTiming = async (userId) => {
    const key = keys(userId);
    const [codeTtl, cooldownTtl] = await Promise.all([redis_1.default.ttl(key.code), redis_1.default.ttl(key.cooldown)]);
    return { codeExpired: codeTtl <= 0, retryAfter: Math.max(0, cooldownTtl) };
};
exports.emailVerificationTiming = emailVerificationTiming;
const issueEmailVerificationCode = async (userId, code) => {
    const key = keys(userId);
    const result = Number(await redis_1.default.eval(ISSUE_SCRIPT, 2, key.code, key.cooldown, code, 600, 60));
    return result === 1 ? 'issued' : 'cooldown';
};
exports.issueEmailVerificationCode = issueEmailVerificationCode;
const checkEmailVerificationCode = async (userId, code, consume) => {
    const key = keys(userId);
    const result = Number(await redis_1.default.eval(CHECK_SCRIPT, 2, key.code, key.attempts, code, 5, 15 * 60, consume ? '1' : '0'));
    if (result === 1)
        return 'valid';
    if (result === -2)
        return 'locked';
    if (result === -1)
        return 'expired';
    return 'invalid';
};
exports.checkEmailVerificationCode = checkEmailVerificationCode;
//# sourceMappingURL=emailVerificationSecurity.service.js.map