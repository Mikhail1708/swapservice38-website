import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import redis from '../../../src/config/redis';
import * as auth from '../../../src/services/auth.service';
import { handleYandexCallback, handleMaxCallback } from '../../../src/services/oauth.service';
import { issuePendingOAuth, readPendingOAuth, completePendingOAuth } from '../../../src/services/pendingOAuth.service';
import authRoutes from '../../../src/routes/auth.routes';
import csrfMiddleware, { getCsrfToken } from '../../../src/middleware/csrf.middleware';
import { personalDataAcceptance } from '../../helpers/consent';

const db = new PrismaClient() as any;
const cache = redis as any;
const profile = { provider: 'yandex' as const, providerId: 'provider-1', email: 'new@example.test', firstName: 'Иван', lastName: 'Иванов' };
const store = new Map<string, { value: string; expires: number }>();
let clock = 0;
const app = express();
app.use(express.json(), cookieParser(), csrfMiddleware);
app.get('/api/csrf-token', getCsrfToken);
app.use('/api/auth', authRoutes);

beforeEach(() => {
  jest.clearAllMocks(); store.clear(); clock = 0;
  process.env.CLIENT_URL = 'https://shop.example.test';
  cache.set.mockImplementation(async (key: string, value: string, mode: string, ttl: number) => {
    expect(mode).toBe('EX'); expect(ttl).toBe(600);
    store.set(key, { value, expires: clock + ttl }); return 'OK';
  });
  cache.get.mockImplementation(async (key: string) => { const item = store.get(key); return item && item.expires > clock ? item.value : null; });
  cache.eval.mockImplementation(async (_script: string, count: number, key: string) => {
    expect(count).toBe(1); const item = store.get(key); store.delete(key);
    return item && item.expires > clock ? item.value : null;
  });
  db.user.findUnique.mockResolvedValue(null); db.user.findFirst.mockResolvedValue(null);
  db.user.create.mockImplementation(async ({ data }: any) => ({ id: 'new-user', ...data }));
  db.user.update.mockResolvedValue({ id: 'existing' });
  db.$transaction.mockImplementation(async (callback: any) => callback(db));
  jest.spyOn(auth, 'generateToken').mockResolvedValue('session-token');
  (axios.post as jest.Mock).mockResolvedValue({ data: { access_token: 'provider-secret' } });
});

describe.each(['yandex', 'max'] as const)('%s OAuth', provider => {
  const callback = provider === 'yandex' ? handleYandexCallback : handleMaxCallback;
  beforeEach(() => {
    (axios.get as jest.Mock).mockResolvedValue({ data: provider === 'yandex'
      ? { id: 'provider-1', default_email: profile.email, first_name: profile.firstName, last_name: profile.lastName }
      : { sub: 'provider-1', email: profile.email, given_name: profile.firstName, family_name: profile.lastName, email_verified: true } });
  });
  it('existing/legacy account logs in without creating user or consent', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'existing', blockedAt: null });
    const result = await callback('code');
    expect(result.token).toBe('session-token');
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.userConsent.upsert).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });
  it('new identity creates only short-lived pending state, then atomic consent-bound user', async () => {
    const result = await callback('code', undefined, '/cart');
    expect(result.pendingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.token).toBeUndefined(); expect(db.user.create).not.toHaveBeenCalled();
    expect(auth.generateToken).not.toHaveBeenCalled();
    expect([...store.keys()][0]).not.toContain(result.pendingToken);
    expect([...store.values()][0].value).not.toContain('provider-secret');
    const context = await readPendingOAuth(result.pendingToken);
    expect(context.profile.provider).toBe(provider);
    await completePendingOAuth(result.pendingToken, personalDataAcceptance);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: profile.email, [provider === 'yandex' ? 'yandexId' : 'maxId']: 'provider-1', role: 'user',
      consents: { create: expect.objectContaining({ type: 'personal_data', scopeVersion: 'account-orders-v1', source: 'registration', documentVersion: personalDataAcceptance.documentVersion, privacyVersion: personalDataAcceptance.privacyVersion }) },
    }) });
  });
  it('callback sets HttpOnly pending cookie and no auth cookie for a new user', async () => {
    const response = await request(app).get(`/api/auth/${provider}/callback?code=code&state=valid-state`).set('Cookie', 'oauth_state=valid-state');
    expect(response.status).toBe(302); expect(response.headers.location).toBe('https://shop.example.test/oauth-consent');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some(value => value.startsWith('oauth_pending=') && value.includes('HttpOnly'))).toBe(true);
    expect(cookies.some(value => value.startsWith('token='))).toBe(false);
  });
});

it.each([undefined, false, { ...personalDataAcceptance, accepted: false }])('missing consent cannot consume pending or create user: %p', async acceptance => {
  const token = await issuePendingOAuth(profile);
  await expect(completePendingOAuth(token, acceptance)).rejects.toMatchObject({ code: 'PERSONAL_DATA_CONSENT_REQUIRED' });
  expect(db.user.create).not.toHaveBeenCalled(); expect(cache.eval).not.toHaveBeenCalled();
  await expect(readPendingOAuth(token)).resolves.toBeDefined();
});
it('invalid, unknown, expired and reused states are rejected', async () => {
  for (const token of ['invalid', 'a'.repeat(43)]) await expect(completePendingOAuth(token, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_PENDING_INVALID' });
  const expired = await issuePendingOAuth(profile); clock = 601;
  await expect(readPendingOAuth(expired)).rejects.toMatchObject({ code: 'OAUTH_PENDING_INVALID' });
  await expect(completePendingOAuth(expired, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_PENDING_INVALID' });
  const token = await issuePendingOAuth(profile); await completePendingOAuth(token, personalDataAcceptance);
  await expect(completePendingOAuth(token, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_PENDING_INVALID' });
  expect(db.user.create).toHaveBeenCalledTimes(1);
});
it('atomic consume allows only one concurrent completion', async () => {
  const token = await issuePendingOAuth(profile);
  const results = await Promise.allSettled([completePendingOAuth(token, personalDataAcceptance), completePendingOAuth(token, personalDataAcceptance)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(db.user.create).toHaveBeenCalledTimes(1);
});
it('nested consent failure rejects the atomic write, consumes state, and issues no session', async () => {
  const token = await issuePendingOAuth(profile);
  db.user.create.mockRejectedValueOnce(new Error('nested consent insert failed'));
  await expect(completePendingOAuth(token, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_REGISTRATION_FAILED' });
  expect(db.$transaction).toHaveBeenCalledTimes(1);
  expect(db.user.create.mock.calls[0][0].data.consents.create).toBeDefined();
  expect(auth.generateToken).not.toHaveBeenCalled();
  await expect(completePendingOAuth(token, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_PENDING_INVALID' });
});
it('a concurrently registered identity is not relinked or logged in using pending state', async () => {
  const token = await issuePendingOAuth(profile); db.user.findFirst.mockResolvedValue({ id: 'existing' });
  await expect(completePendingOAuth(token, personalDataAcceptance)).rejects.toMatchObject({ code: 'OAUTH_ACCOUNT_EXISTS' });
  expect(db.user.create).not.toHaveBeenCalled();
});
it('HTTP completion enforces CSRF, consent, strict identity-free body and cookie-bound state', async () => {
  const token = await issuePendingOAuth(profile);
  const agent = request.agent(app);
  const csrf = await agent.get('/api/csrf-token');
  const cookie = `oauth_pending=${token}`;
  const context = await agent.get('/api/auth/oauth/consent').set('Cookie', cookie);
  expect(context.status).toBe(200); expect(context.headers['cache-control']).toBe('no-store');
  expect(Object.keys(context.body).sort()).toEqual(['documents', 'provider']);
  expect((await agent.post('/api/auth/oauth/consent').set('Cookie', cookie).send({ personalDataConsent: personalDataAcceptance })).status).toBe(403);
  for (const body of [{}, { personalDataConsent: personalDataAcceptance, email: 'attacker@example.test', provider: 'max', providerId: 'other' }]) {
    const response = await agent.post('/api/auth/oauth/consent').set('Cookie', cookie).set('x-csrf-token', csrf.body.csrfToken).send(body);
    expect(response.status).toBe(400);
  }
  expect(db.user.create).not.toHaveBeenCalled();
  const response = await agent.post('/api/auth/oauth/consent').set('Cookie', cookie).set('x-csrf-token', csrf.body.csrfToken).send({ personalDataConsent: personalDataAcceptance });
  expect(response.status).toBe(200); expect(response.body).toEqual({ redirect: '/' });
  expect(db.user.create.mock.calls[0][0].data.email).toBe(profile.email);
});
