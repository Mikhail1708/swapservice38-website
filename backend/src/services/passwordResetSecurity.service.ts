import { createHash, randomInt } from 'crypto';
import redis from '@config/redis';

const DEFAULT_CODE_TTL_SECONDS = 15 * 60;
const DEFAULT_REQUEST_COOLDOWN_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_ATTEMPT_WINDOW_SECONDS = 15 * 60;

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const accountKey = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

const keysFor = (email: string) => {
  const account = accountKey(email);
  return {
    code: `password-reset:${account}:code`,
    attempts: `password-reset:${account}:attempts`,
    cooldown: `password-reset:${account}:cooldown`,
  };
};

const ISSUE_CODE_SCRIPT = `
local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
if attempts >= tonumber(ARGV[4]) then
  return -1
end
local cooldown = redis.call('SET', KEYS[3], '1', 'EX', ARGV[2], 'NX')
if not cooldown then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
return 1
`;

const CHECK_CODE_SCRIPT = `
local maxAttempts = tonumber(ARGV[2])
local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
if attempts >= maxAttempts then
  redis.call('DEL', KEYS[1])
  return -2
end

local stored = redis.call('GET', KEYS[1])
if not stored then
  return -1
end

if stored == ARGV[1] then
  if ARGV[4] == '1' then
    redis.call('DEL', KEYS[1], KEYS[2])
  end
  return 1
end

attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[2], ARGV[3])
end
if attempts >= maxAttempts then
  redis.call('DEL', KEYS[1])
  return -2
end
return 0
`;

export type ResetCodeCheck = 'valid' | 'invalid' | 'expired' | 'locked';

export const generatePasswordResetCode = (): string =>
  randomInt(100000, 1000000).toString();

export const issuePasswordResetCode = async (
  email: string,
  code: string
): Promise<'issued' | 'cooldown' | 'locked'> => {
  const keys = keysFor(email);
  const result = Number(await redis.eval(
    ISSUE_CODE_SCRIPT,
    3,
    keys.code,
    keys.attempts,
    keys.cooldown,
    code,
    positiveInteger(process.env.PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS, DEFAULT_REQUEST_COOLDOWN_SECONDS),
    positiveInteger(process.env.PASSWORD_RESET_CODE_TTL_SECONDS, DEFAULT_CODE_TTL_SECONDS),
    positiveInteger(process.env.PASSWORD_RESET_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS)
  ));

  if (result === 1) return 'issued';
  if (result === -1) return 'locked';
  return 'cooldown';
};

export const checkPasswordResetCode = async (
  email: string,
  code: string,
  consume: boolean
): Promise<ResetCodeCheck> => {
  const keys = keysFor(email);
  const result = Number(await redis.eval(
    CHECK_CODE_SCRIPT,
    2,
    keys.code,
    keys.attempts,
    code,
    positiveInteger(process.env.PASSWORD_RESET_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    positiveInteger(process.env.PASSWORD_RESET_ATTEMPT_WINDOW_SECONDS, DEFAULT_ATTEMPT_WINDOW_SECONDS),
    consume ? '1' : '0'
  ));

  if (result === 1) return 'valid';
  if (result === -2) return 'locked';
  if (result === -1) return 'expired';
  return 'invalid';
};

