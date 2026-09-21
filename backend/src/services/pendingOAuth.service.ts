import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import redis from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { personalDataEvidence } from './consent.service';

import { prisma } from '../config/prisma';
const profileSchema = z.object({
  provider: z.literal('yandex'), providerId: z.string().min(1).max(200),
  email: z.string().email().max(254), firstName: z.string().max(200), lastName: z.string().max(200),
  phone: z.string().max(50).nullable().optional(),
});
export type PendingOAuthProfile = z.infer<typeof profileSchema>;
const pendingSchema = z.object({ profile: profileSchema, redirect: z.string(), guestId: z.string().optional() });
const invalid = () => new AppError('Сеанс регистрации недействителен или истёк. Повторите вход через сервис', 400, 'OAUTH_PENDING_INVALID');
const keyFor = (token: unknown) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
  return `oauth:pending-registration:v1:${createHash('sha256').update(token).digest('hex')}`;
};
export const safePendingRedirect = (value: unknown) =>
  typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020\u007f]/.test(value) ? value : '/';

// Only provider-verified data reaches this function. No access/refresh token is retained.
export async function issuePendingOAuth(profile: PendingOAuthProfile, guestId?: string, redirect?: string) {
  const verified = profileSchema.parse(profile);
  const token = randomBytes(32).toString('base64url');
  await redis.set(keyFor(token), JSON.stringify({ profile: verified, guestId, redirect: safePendingRedirect(redirect) }), 'EX', 600);
  return token;
}
export async function readPendingOAuth(token: unknown) {
  const value = await redis.get(keyFor(token));
  if (!value) throw invalid();
  const parsed = pendingSchema.safeParse(JSON.parse(value));
  if (!parsed.success) throw invalid();
  return parsed.data;
}

export async function completePendingOAuth(token: unknown, acceptance: unknown) {
  const evidence = personalDataEvidence(acceptance, 'registration');
  // Atomic consume before DB effects: concurrent requests and retries cannot replay identity.
  // On a DB failure restart OAuth; never restore a consumed credential.
  const value = await redis.eval("local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v", 1, keyFor(token));
  if (typeof value !== 'string') throw invalid();
  const parsed = pendingSchema.safeParse(JSON.parse(value));
  if (!parsed.success) throw invalid();
  const { profile, redirect, guestId } = parsed.data;
  const identity = { yandexId: profile.providerId };
  try {
    const user = await prisma.$transaction(async tx => {
      const existing = await tx.user.findFirst({ where: { OR: [identity, { email: { equals: profile.email, mode: 'insensitive' } }] } });
      if (existing) throw new AppError('Аккаунт уже существует. Повторите вход', 409, 'OAUTH_ACCOUNT_EXISTS');
      return tx.user.create({ data: {
        ...identity, email: profile.email, firstName: profile.firstName, lastName: profile.lastName,
        phone: profile.phone || null, isVerified: true, role: 'user', consents: { create: evidence },
      } });
    }, { isolationLevel: 'Serializable' });
    return { user, redirect: safePendingRedirect(redirect), guestId };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Не удалось завершить регистрацию. Повторите вход через сервис', 409, 'OAUTH_REGISTRATION_FAILED');
  }
}
