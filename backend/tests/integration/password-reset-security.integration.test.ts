import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import redis from '@config/redis';
import { app } from '../../src/server';

const prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
const mockRedis = redis as jest.Mocked<typeof redis>;

const csrfSession = async () => {
  const agent = request.agent(app);
  const tokenResponse = await agent.get('/api/csrf-token');
  return { agent, token: tokenResponse.body.csrfToken as string };
};

describe('Password reset security HTTP flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not enumerate missing, OAuth-only, and password accounts', async () => {
    const { agent, token } = await csrfSession();
    mockRedis.eval.mockResolvedValue(1);
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: 'oauth@example.com', passwordHash: null })
      .mockResolvedValueOnce({ email: 'user@example.com', passwordHash: 'hash' });

    const responses = [];
    for (const email of ['missing@example.com', 'oauth@example.com', 'user@example.com']) {
      responses.push(await agent
        .post('/api/auth/reset-password/request')
        .set('X-CSRF-Token', token)
        .send({ email }));
    }

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(responses[1].body).toEqual(responses[2].body);
  });

  it('fails the attempt endpoint closed when Redis is unavailable', async () => {
    const { agent, token } = await csrfSession();
    mockRedis.eval.mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await agent
      .post('/api/auth/reset-password/verify')
      .set('X-CSRF-Token', token)
      .send({ email: 'user@example.com', code: '123456' });

    expect(response.status).toBe(503);
  });

  it('enforces the route-level IP attempt limit before code validation', async () => {
    const { agent, token } = await csrfSession();
    mockRedis.eval.mockResolvedValueOnce(31);

    const response = await agent
      .post('/api/auth/reset-password/confirm')
      .set('X-CSRF-Token', token)
      .send({
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPass1!',
      });

    expect(response.status).toBe(429);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

