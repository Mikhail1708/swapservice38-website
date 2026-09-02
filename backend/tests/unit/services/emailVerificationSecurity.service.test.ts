import redis from '@config/redis';
import {
  checkEmailVerificationCode,
  generateEmailVerificationCode,
  issueEmailVerificationCode,
} from '../../../src/services/emailVerificationSecurity.service';

const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Email verification security service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses cryptographically generated six-digit codes', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateEmailVerificationCode()).toMatch(/^\d{6}$/);
    }
  });

  it.each([[1, 'issued'], [0, 'cooldown']] as const)(
    'maps atomic issue result %s to %s',
    async (redisResult, expected) => {
      mockRedis.eval.mockResolvedValueOnce(redisResult);
      await expect(issueEmailVerificationCode('user-id', '123456')).resolves.toBe(expected);
    },
  );

  it.each([[1, 'valid'], [0, 'invalid'], [-1, 'expired'], [-2, 'locked']] as const)(
    'maps atomic check result %s to %s',
    async (redisResult, expected) => {
      mockRedis.eval.mockResolvedValueOnce(redisResult);
      await expect(checkEmailVerificationCode('user-id', '123456', false)).resolves.toBe(expected);
    },
  );

  it('consumes a valid code only on final verification', async () => {
    mockRedis.eval.mockResolvedValue(1);
    await checkEmailVerificationCode('user-id', '123456', false);
    await checkEmailVerificationCode('user-id', '123456', true);
    const firstCall = mockRedis.eval.mock.calls[0];
    const secondCall = mockRedis.eval.mock.calls[1];
    expect(firstCall[firstCall.length - 1]).toBe('0');
    expect(secondCall[secondCall.length - 1]).toBe('1');
  });
});
