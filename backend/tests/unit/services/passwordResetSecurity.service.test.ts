import redis from '@config/redis';
import {
  checkPasswordResetCode,
  generatePasswordResetCode,
  issuePasswordResetCode,
} from '../../../src/services/passwordResetSecurity.service';

const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Password reset security service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PASSWORD_RESET_MAX_ATTEMPTS;
    delete process.env.PASSWORD_RESET_CODE_TTL_SECONDS;
    delete process.env.PASSWORD_RESET_ATTEMPT_WINDOW_SECONDS;
    delete process.env.PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS;
  });

  it('generates a six-digit code in the configured numeric space', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(generatePasswordResetCode()).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it.each([
    [1, 'issued'],
    [0, 'cooldown'],
    [-1, 'locked'],
  ] as const)('maps atomic issue result %s to %s', async (redisResult, expected) => {
    mockRedis.eval.mockResolvedValueOnce(redisResult);

    await expect(issuePasswordResetCode('User@Example.com', '123456')).resolves.toBe(expected);
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
  });

  it('uses the same account key for email case variants', async () => {
    mockRedis.eval.mockResolvedValue(1);

    await issuePasswordResetCode('User@Example.com', '123456');
    await issuePasswordResetCode('user@example.com', '654321');

    const firstKeys = (mockRedis.eval.mock.calls[0] as unknown[]).slice(2, 5);
    const secondKeys = (mockRedis.eval.mock.calls[1] as unknown[]).slice(2, 5);
    expect(firstKeys).toEqual(secondKeys);
    expect(String(firstKeys[0])).not.toContain('user@example.com');
  });

  it.each([
    [1, 'valid'],
    [0, 'invalid'],
    [-1, 'expired'],
    [-2, 'locked'],
  ] as const)('maps atomic check result %s to %s', async (redisResult, expected) => {
    mockRedis.eval.mockResolvedValueOnce(redisResult);
    await expect(checkPasswordResetCode('user@example.com', '123456', false)).resolves.toBe(expected);
  });

  it('passes consume only for confirmation', async () => {
    mockRedis.eval.mockResolvedValue(1);

    await checkPasswordResetCode('user@example.com', '123456', false);
    await checkPasswordResetCode('user@example.com', '123456', true);

    const verifyCall = mockRedis.eval.mock.calls[0];
    const confirmCall = mockRedis.eval.mock.calls[1];
    expect(verifyCall[verifyCall.length - 1]).toBe('0');
    expect(confirmCall[confirmCall.length - 1]).toBe('1');
  });

  it('fails closed when Redis is unavailable', async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(checkPasswordResetCode('user@example.com', '123456', false))
      .rejects.toThrow('Redis unavailable');
  });
});
