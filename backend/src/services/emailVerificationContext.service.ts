import { createHash, randomBytes } from 'crypto';
import redis from '../config/redis';
import { AppError } from '../middleware/error.middleware';

// This opaque capability identifies a verification, but never replaces its code
// or grants a session. Keep it usable for resend after the 10-minute code TTL.
const CONTEXT_TTL = 24 * 60 * 60;
const contextKey = (token: string) =>
  `email-verification-context:${createHash('sha256').update(token).digest('hex')}`;

export const createVerificationContext = async (userId: string): Promise<string> => {
  const token = randomBytes(32).toString('base64url');
  await redis.setex(contextKey(token), CONTEXT_TTL, userId);
  return token;
};

export const resolveVerificationContext = async (token: string): Promise<string> => {
  const userId = /^[A-Za-z0-9_-]{43}$/.test(token)
    ? await redis.get(contextKey(token))
    : null;
  if (!userId) throw new AppError('Ссылка недействительна или срок её действия истёк. Запросите новое письмо.', 400, 'VERIFICATION_LINK_INVALID');
  return userId;
};

export const maskVerificationEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : '***';
};
