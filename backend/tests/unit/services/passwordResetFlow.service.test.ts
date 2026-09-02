import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import redis from '@config/redis';
import { sendPasswordResetEmail } from '@services/email.service';
import {
  confirmResetPassword,
  requestPasswordReset,
  verifyResetCode,
} from '../../../src/services/auth.service';

jest.mock('bcrypt');

const prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockSendEmail = sendPasswordResetEmail as jest.Mock;

describe('Password reset flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1', email: 'user@example.com', passwordHash: 'hash',
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('returns the same generic response for missing and OAuth-only accounts', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'oauth-1', email: 'oauth@example.com', passwordHash: null });

    const missing = await requestPasswordReset('missing@example.com');
    const oauth = await requestPasswordReset('oauth@example.com');

    expect(missing).toEqual(oauth);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('sends email only when the atomic issue operation creates a code', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'hash',
    });
    mockRedis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await requestPasswordReset('user@example.com');
    await requestPasswordReset('user@example.com');

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toMatch(/^[1-9]\d{5}$/);
  });

  it('rejects invalid, expired, and locked checks with one generic error', async () => {
    for (const result of [0, -1, -2]) {
      mockRedis.eval.mockResolvedValueOnce(result);
      await expect(verifyResetCode('user@example.com', '123456'))
        .rejects.toThrow('Неверный или просроченный код');
    }
  });

  it('confirms a valid code and updates the password once', async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('new-hash');
    (prisma.user.update as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });

    await expect(confirmResetPassword('user@example.com', '123456', 'NewPass1!'))
      .resolves.toEqual({ message: 'Пароль успешно изменён' });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('rejects replay after the code has been consumed', async () => {
    mockRedis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(-1);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1' });

    await confirmResetPassword('user@example.com', '123456', 'NewPass1!');
    await expect(confirmResetPassword('user@example.com', '123456', 'NewPass1!'))
      .rejects.toThrow('Неверный или просроченный код');
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('allows at most one password update for concurrent confirmations', async () => {
    mockRedis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(-1);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1' });

    const results = await Promise.allSettled([
      confirmResetPassword('user@example.com', '123456', 'NewPass1!'),
      confirmResetPassword('user@example.com', '123456', 'OtherPass1!'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('does not consume a code for an invalid new password', async () => {
    await expect(confirmResetPassword('user@example.com', '123456', 'short'))
      .rejects.toThrow('Минимум 8 символов');
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });
});
