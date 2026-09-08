// backend/tests/unit/services/auth.service.test.ts
import { register, login, verifyEmail, changePassword, requestPasswordChange, confirmPasswordChange } from '../../../src/services/auth.service';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { personalDataAcceptance } from '../../helpers/consent';

// ✅ МОКИ ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

// ✅ ПОЛУЧАЕМ МОКИ
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// ✅ МОКИ ДЛЯ REDIS И EMAIL (из setup.ts)

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRES_IN = '7d';
  });

  // ============================================================
  // REGISTER
  // ============================================================
  describe('register', () => {
    it.each([undefined, false, { ...personalDataAcceptance, accepted: false }])('rejects missing/false consent before creating a user: %p', async (acceptance) => {
      await expect(register('test@example.com', 'Test1234!', undefined, undefined, undefined, acceptance))
        .rejects.toMatchObject({ statusCode: 400, code: 'PERSONAL_DATA_CONSENT_REQUIRED' });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('does not enqueue verification when the atomic nested user/consent write fails', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
      const mail = require('../../../src/services/email.service');
      await expect(register('test@example.com', 'Test1234!', undefined, undefined, undefined, personalDataAcceptance)).rejects.toThrow('write failed');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    });
    const registerData = {
      email: 'test@example.com',
      password: 'Test1234!',
      firstName: 'Test',
      lastName: 'User'
    };

    it('should register user and send verification email', async () => {
      // ✅ ПРАВИЛЬНЫЙ МОК
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        isVerified: false,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      const result = await register(
        registerData.email,
        registerData.password,
        registerData.firstName,
        registerData.lastName, undefined, personalDataAcceptance
      );

      expect(result).toEqual({ message: 'Код отправлен на почту', verificationToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ consents: { create: expect.objectContaining({
          type: 'personal_data', scopeVersion: 'account-orders-v1',
          documentVersion: personalDataAcceptance.documentVersion, source: 'registration',
        }) } }),
      }));
    });

    it('should throw error if user already exists', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: registerData.email,
        isVerified: true,
      });

      await expect(
        register(registerData.email, registerData.password, undefined, undefined, undefined, personalDataAcceptance)
      ).rejects.toThrow('Пользователь с таким email уже зарегистрирован');

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // VERIFY EMAIL
  // ============================================================
  describe('verifyEmail', () => {
    const email = 'test@example.com';
    const code = '123456';

    it('should verify user email with valid code', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(1);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email, isVerified: false });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email,
        isVerified: true,
      });

      const result = await verifyEmail(email, code);

      expect(result).toEqual({ message: 'Email подтверждён' });
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw error if code is invalid', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(0);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email, isVerified: false });

      await expect(verifyEmail(email, code)).rejects.toThrow(
        'Неверный или просроченный код'
      );
    });

    it('should throw error if code is expired', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(-1);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email, isVerified: false });

      await expect(verifyEmail(email, code)).rejects.toThrow(
        'Неверный или просроченный код'
      );
    });

    it('does not reveal that an address is already verified', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email, isVerified: true });

      await expect(verifyEmail(email, code)).rejects.toThrow('Неверный или просроченный код');
    });

    it('fails closed when legacy rows differ only by email case', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email, isVerified: false });
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', email: 'test@example.com', isVerified: false },
        { id: 'user-2', email: 'Test@example.com', isVerified: false },
      ]);

      await expect(verifyEmail(email, code)).rejects.toThrow('Неверный или просроченный код');
    });
  });

  // ============================================================
  // LOGIN
  // ============================================================
  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'Test1234!',
    };

    it('should login user and return JWT token', async () => {
      const mockUser = {
        id: 'user-1',
        email: loginData.email,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        phone: '+79999999999',
        address: 'г. Иркутск',
        isVerified: true,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock_jwt_token');

      const result = await login(loginData.email, loginData.password);

      expect(result).toHaveProperty('token', 'mock_jwt_token');
      expect(result.user).toHaveProperty('id', mockUser.id);
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(login(loginData.email, loginData.password)).rejects.toThrow(
        'Неверный email или пароль'
      );
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });

    it('should throw error if email not verified', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: loginData.email,
        passwordHash: 'hashed_password',
        isVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(login(loginData.email, loginData.password)).rejects.toThrow(
        'Email не подтверждён'
      );
    });

    it('should throw error if password is incorrect', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: loginData.email,
        passwordHash: 'hashed_password',
        isVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(login(loginData.email, loginData.password)).rejects.toThrow(
        'Неверный email или пароль'
      );
    });

    it('does not issue a session for a blocked user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: loginData.email, passwordHash: 'hashed_password', isVerified: true, blockedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(login(loginData.email, loginData.password)).rejects.toThrow('Неверный email или пароль');
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================
  describe('changePassword', () => {
    const userId = 'user-1';
    const currentPassword = 'Old1234!';
    const newPassword = 'New1234!';

    it('should change password with valid current password', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: 'old_hashed_password',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({ message: 'Пароль успешно изменён' });
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Пользователь не найден');
    });

    it('should throw error if user has no password (OAuth)', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: null,
      });

      await expect(
        changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('У этого аккаунта нет пароля (используйте OAuth)');
    });

    it('should throw error if current password is incorrect', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: 'old_hashed_password',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Неверный текущий пароль');
    });
  });

  // ============================================================
  // REQUEST PASSWORD CHANGE
  // ============================================================
  describe('requestPasswordChange', () => {
    const userId = 'user-1';
    const email = 'test@example.com';

    it('should send password change code to email', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(1);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: email,
        passwordHash: 'hashed_password',
      });

      const result = await requestPasswordChange(userId, email);

      expect(result).toEqual({ message: 'Код подтверждения отправлен на почту' });
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(requestPasswordChange(userId, email)).rejects.toThrow(
        'Пользователь не найден'
      );
    });

    it('should throw error if email does not match', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'wrong@example.com',
        passwordHash: 'hashed_password',
      });

      await expect(requestPasswordChange(userId, email)).rejects.toThrow(
        'Email не совпадает с email пользователя'
      );
    });
  });

  // ============================================================
  // CONFIRM PASSWORD CHANGE
  // ============================================================
  describe('confirmPasswordChange', () => {
    const userId = 'user-1';
    const code = '123456';
    const newPassword = 'New1234!';

    it('should confirm password change with valid code', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(1);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await confirmPasswordChange(userId, code, newPassword);

      expect(result).toEqual({ message: 'Пароль успешно изменён' });
    });

    it('should throw error if code is invalid', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(0);

      await expect(
        confirmPasswordChange(userId, code, newPassword)
      ).rejects.toThrow('Неверный или просроченный код');
    });

    it('should throw error if code is expired', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(-1);

      await expect(
        confirmPasswordChange(userId, code, newPassword)
      ).rejects.toThrow('Неверный или просроченный код');
    });

    it('should throw error if password is too short', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(1);

      await expect(
        confirmPasswordChange(userId, code, 'short')
      ).rejects.toThrow('Минимум 8 символов');
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('rejects Cyrillic characters in the emailed password-change flow', async () => {
      const redis = require('../../../src/config/redis').default;
      redis.eval.mockResolvedValue(1);
      await expect(confirmPasswordChange(userId, code, 'Valid1Пароль'))
        .rejects.toThrow('Используйте только латинские символы');
      expect(redis.eval).not.toHaveBeenCalled();
    });
  });
});
