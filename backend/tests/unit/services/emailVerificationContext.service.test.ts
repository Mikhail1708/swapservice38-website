import { PrismaClient } from '@prisma/client';
import redis from '../../../src/config/redis';
import { createVerificationContext, resolveVerificationContext } from '../../../src/services/emailVerificationContext.service';
import { getVerificationContext, verifyEmail, resendVerification } from '../../../src/services/auth.service';
import { sendVerificationEmail } from '../../../src/services/email.service';
import { verificationEmailTemplate } from '../../../src/services/emailTemplates';

const db = new PrismaClient() as any;
const cache = redis as any;

describe('opaque email verification context', () => {
  let entries: Map<string, string>;
  beforeEach(() => {
    jest.clearAllMocks();
    entries = new Map();
    cache.setex.mockImplementation(async (key: string, _ttl: number, value: string) => { entries.set(key, value); return 'OK'; });
    cache.get.mockImplementation(async (key: string) => entries.get(key) || null);
    cache.ttl.mockResolvedValue(0);
    cache.eval.mockResolvedValue(1);
    db.user.findUnique.mockResolvedValue({ id: 'user-A', email: 'mikhail@yandex.ru', isVerified: false });
    db.user.update.mockResolvedValue({ id: 'user-A', isVerified: true });
    process.env.PUBLIC_APP_URL = 'https://shop.example.test';
  });

  it('stores only a hash of a random token with TTL and exposes only masked identity', async () => {
    const token = await createVerificationContext('user-A');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cache.setex).toHaveBeenCalledWith(expect.stringMatching(/^email-verification-context:[a-f0-9]{64}$/), 86400, 'user-A');
    expect([...entries.keys()].join()).not.toContain(token);
    const context = await getVerificationContext(token);
    expect(context).toEqual({ maskedEmail: 'mi***@yandex.ru', alreadyVerified: false, codeExpired: true, retryAfter: 0 });
    expect(JSON.stringify(context)).not.toContain('mikhail');
  });

  it('verifies the token-bound user through the existing code checker and consumes the code', async () => {
    const token = await createVerificationContext('user-A');
    await expect(verifyEmail(undefined, '482196', token)).resolves.toEqual({ message: 'Email подтверждён' });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-A' }, data: { isVerified: true } });
    expect(cache.eval.mock.calls[0]).toEqual(expect.arrayContaining(['email-verification:user-A:code', '482196', '0']));
    expect(cache.eval.mock.calls[1].at(-1)).toBe('1');
  });

  it.each(['invalid', 'A'.repeat(43)])('rejects invalid/unknown token without updating a user: %s', async (token) => {
    await expect(verifyEmail(undefined, '482196', token)).rejects.toMatchObject({ code: 'VERIFICATION_LINK_INVALID' });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('rejects an expired link and tokens belonging to a different flow namespace', async () => {
    const token = await createVerificationContext('user-A');
    const key = [...entries.keys()][0];
    entries.clear(); // Redis expiration
    entries.set(key.replace('email-verification-context:', 'password-reset-context:'), 'user-A');
    await expect(resolveVerificationContext(token)).rejects.toMatchObject({ code: 'VERIFICATION_LINK_INVALID' });
  });

  it('does not accept another user verification code', async () => {
    const token = await createVerificationContext('user-A');
    cache.eval.mockResolvedValue(0);
    await expect(verifyEmail(undefined, '999999', token)).rejects.toThrow('Неверный или просроченный код');
    expect(cache.eval.mock.calls[0][2]).toBe('email-verification:user-A:code');
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('allows repeat opening of a verified link without changing the account or issuing a session', async () => {
    const token = await createVerificationContext('user-A');
    db.user.findUnique.mockResolvedValue({ id: 'user-A', email: 'mikhail@yandex.ru', isVerified: true });
    expect((await getVerificationContext(token)).alreadyVerified).toBe(true);
    await expect(verifyEmail(undefined, '000000', token)).resolves.toMatchObject({ alreadyVerified: true });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(cache.eval).not.toHaveBeenCalled();
  });

  it('resends for the same pending user and leaves the original link usable', async () => {
    const token = await createVerificationContext('user-A');
    await expect(resendVerification(undefined, token)).resolves.toMatchObject({ retryAfter: 60 });
    expect(sendVerificationEmail).toHaveBeenCalledWith('mikhail@yandex.ru', expect.stringMatching(/^\d{6}$/), undefined, expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    await expect(resolveVerificationContext(token)).resolves.toBe('user-A');
  });

  it('preserves resend cooldown without sending another message', async () => {
    const token = await createVerificationContext('user-A');
    cache.eval.mockResolvedValue(0);
    cache.ttl.mockResolvedValue(35);
    await expect(resendVerification(undefined, token)).rejects.toMatchObject({ statusCode: 429, details: { retryAfter: 35 } });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('places only context token in the email URL, never code or email', async () => {
    const token = await createVerificationContext('user-A');
    const template = verificationEmailTemplate('482196', 'Михаил', token);
    const urls = [...template.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(urls).toContain(`https://shop.example.test/verify-email?token=${token}`);
    expect(urls.join()).not.toContain('482196');
    expect(urls.join()).not.toContain('mikhail');
    expect(template.html).toContain('482196');
    expect(template.text).toContain(`?token=${token}`);
  });
});
