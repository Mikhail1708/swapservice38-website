import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import redis from '../../../src/config/redis';
import { validate } from '../../../src/middleware/validate.middleware';
import { verificationContextSchema, verifySchema, resendVerificationSchema } from '../../../src/schemas/auth.schema';
import { verificationContextController, verifyController, resendVerificationController } from '../../../src/controllers/auth.controller';

const db = new PrismaClient() as any;
const cache = redis as any;
const token = 'a'.repeat(43);
const app = express();
app.use(express.json());
app.post('/context', validate(verificationContextSchema), verificationContextController);
app.post('/verify', validate(verifySchema), verifyController);
app.post('/resend', validate(resendVerificationSchema), resendVerificationController);

describe('verification context HTTP contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue('user-A');
    cache.ttl.mockResolvedValue(40);
    cache.eval.mockResolvedValue(1);
    db.user.findUnique.mockResolvedValue({ id: 'user-A', email: 'mikhail@yandex.ru', isVerified: false });
    db.user.update.mockResolvedValue({ id: 'user-A', isVerified: true });
  });

  it('returns only masked context with no-store and never issues a session', async () => {
    const response = await request(app).post('/context').send({ token });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ maskedEmail: 'mi***@yandex.ru', alreadyVerified: false, codeExpired: false, retryAfter: 40 });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects supplying email alongside a different verification token', async () => {
    const response = await request(app).post('/verify').send({ token, email: 'other@example.com', code: '482196' });
    expect(response.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(cache.eval).not.toHaveBeenCalled();
  });

  it('returns safe invalid/expired link errors', async () => {
    cache.get.mockResolvedValue(null);
    const response = await request(app).post('/context').send({ token });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VERIFICATION_LINK_INVALID');
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it('returns safe expired-code error without changing user', async () => {
    cache.eval.mockResolvedValue(-1);
    const response = await request(app).post('/verify').send({ token, code: '482196' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Неверный или просроченный код');
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('returns authoritative resend cooldown in JSON and Retry-After', async () => {
    cache.eval.mockResolvedValue(0);
    const response = await request(app).post('/resend').send({ token });
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('40');
    expect(response.body.details).toEqual({ retryAfter: 40 });
  });
});
