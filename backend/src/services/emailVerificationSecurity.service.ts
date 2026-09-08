import { randomInt } from 'crypto';
import redis from '@config/redis';

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
const keys = (userId: string) => ({
  code: `email-verification:${userId}:code`,
  attempts: `email-verification:${userId}:attempts`,
  cooldown: `email-verification:${userId}:cooldown`,
});

export const generateEmailVerificationCode = (): string =>
  randomInt(100000, 1000000).toString();

export const emailVerificationTiming = async (userId: string) => {
  const key = keys(userId);
  const [codeTtl, cooldownTtl] = await Promise.all([redis.ttl(key.code), redis.ttl(key.cooldown)]);
  return { codeExpired: codeTtl <= 0, retryAfter: Math.max(0, cooldownTtl) };
};

export const issueEmailVerificationCode = async (userId: string, code: string): Promise<'issued' | 'cooldown'> => {
  const key = keys(userId);
  const result = Number(await redis.eval(ISSUE_SCRIPT, 2, key.code, key.cooldown, code, 600, 60));
  return result === 1 ? 'issued' : 'cooldown';
};

export const checkEmailVerificationCode = async (
  userId: string,
  code: string,
  consume: boolean,
): Promise<'valid' | 'invalid' | 'expired' | 'locked'> => {
  const key = keys(userId);
  const result = Number(await redis.eval(
    CHECK_SCRIPT, 2, key.code, key.attempts, code, 5, 15 * 60, consume ? '1' : '0',
  ));
  if (result === 1) return 'valid';
  if (result === -2) return 'locked';
  if (result === -1) return 'expired';
  return 'invalid';
};
