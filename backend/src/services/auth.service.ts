// backend/src/services/auth.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail } from './email.service';
import {
  checkPasswordResetCode,
  generatePasswordResetCode,
  issuePasswordResetCode,
} from './passwordResetSecurity.service';
import { passwordSchema } from '../schemas/common.schema';
import { credentialVersion } from '../utils/credentialVersion';
import {
  checkEmailVerificationCode,
  generateEmailVerificationCode,
  issueEmailVerificationCode,
} from './emailVerificationSecurity.service';

const prisma = new PrismaClient();
const DUMMY_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const findUserByEmailIdentity = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const exact = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const matches = await prisma.user.findMany({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    take: 2,
  });
  // Resolve legacy mixed-case identities only when unambiguous. A real exact
  // row is included in this case-insensitive query; the fallback supports
  // isolated Prisma mocks without weakening production behavior.
  if (exact) return matches.length > 1 ? null : (matches[0] || exact);
  return matches.length === 1 ? matches[0] : null;
};

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
};

const jwtExpiresIn = (): SignOptions['expiresIn'] =>
  (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export const register = async (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  middleName?: string
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });
  if (existing) {
    throw new Error('Пользователь с таким email уже зарегистрирован');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      middleName, // ✅ ОТЧЕСТВО
      isVerified: false,
      role: 'user',
    },
  });

  const code = generateEmailVerificationCode();
  await issueEmailVerificationCode(user.id, code);

  await sendVerificationEmail(normalizedEmail, code);

  return { message: 'Код отправлен на почту' };
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
export const verifyEmail = async (email: string, code: string) => {
  const user = await findUserByEmailIdentity(email);
  if (!user) {
    throw new Error('Неверный или просроченный код');
  }
  // A verified address must not be distinguishable from an unknown address by
  // submitting an arbitrary code to this public endpoint.
  if (user.isVerified) throw new Error('Неверный или просроченный код');
  const verification = await checkEmailVerificationCode(user.id, code, false);
  if (verification !== 'valid') throw new Error('Неверный или просроченный код');

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  await checkEmailVerificationCode(user.id, code, true);

  return { message: 'Email подтверждён' };
};

export const resendVerification = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmailIdentity(normalizedEmail);
  const code = generateEmailVerificationCode();
  const accountId = user && !user.isVerified ? user.id : `non-actionable:${normalizedEmail}`;
  const issue = await issueEmailVerificationCode(accountId, code);
  if (user && !user.isVerified && issue === 'issued') {
    await sendVerificationEmail(user.email, code);
  }
  return { message: 'Если подтверждение требуется, письмо отправлено' };
};

// ============================================================
// ЛОГИН
// ============================================================
export const login = async (email: string, password: string) => {
  const user = await findUserByEmailIdentity(email);
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !user.passwordHash || !valid || user.blockedAt) {
    throw new Error('Неверный email или пароль');
  }
  if (!user.isVerified) {
    const error = new Error('Email не подтверждён') as Error & { code?: string };
    error.code = 'EMAIL_UNVERIFIED';
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, cv: credentialVersion(user.passwordHash) },
    getJwtSecret(),
    { expiresIn: jwtExpiresIn() }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName, // ✅ ОТЧЕСТВО
      role: user.role,
      phone: user.phone,
      address: user.address,
    },
  };
};

// ============================================================
// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ПО ID
// ============================================================
export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      middleName: true, // ✅ ОТЧЕСТВО
      phone: true,
      address: true,
      role: true,
      isVerified: true,
      yandexId: true,
      maxId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  return user;
};

// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
export const updateProfile = async (
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    phone?: string;
    address?: string;
  }
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName, // ✅ ОТЧЕСТВО
      phone: data.phone,
      address: data.address,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      middleName: true, // ✅ ОТЧЕСТВО
      phone: true,
      address: true,
      role: true,
      isVerified: true,
      yandexId: true,
      maxId: true,
    },
  });

  return { user: updated, message: 'Профиль обновлён' };
};

// ============================================================
// СМЕНА ПАРОЛЯ С ТЕКУЩИМ ПАРОЛЕМ
// ============================================================
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const passwordResult = passwordSchema.safeParse(newPassword);
  if (!passwordResult.success) {
    throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  if (!user.passwordHash) {
    throw new Error('У этого аккаунта нет пароля (используйте OAuth)');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new Error('Неверный текущий пароль');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: 'Пароль успешно изменён' };
};

// ============================================================
// ЗАПРОС НА СМЕНУ ПАРОЛЯ ЧЕРЕЗ ПОЧТУ (для авторизованных)
// ============================================================
export const requestPasswordChange = async (userId: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  if (user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Email не совпадает с email пользователя');
  }

  if (!user.passwordHash) {
    throw new Error('У этого аккаунта нет пароля (используйте OAuth)');
  }

  const code = generatePasswordResetCode();
  const issueResult = await issuePasswordResetCode(`password-change:${userId}`, code);
  if (issueResult !== 'issued') throw new Error('Новый код можно запросить позже');

  await sendPasswordChangeEmail(email, code);

  return { message: 'Код подтверждения отправлен на почту' };
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ СМЕНЫ ПАРОЛЯ (для авторизованных)
// ============================================================
export const confirmPasswordChange = async (
  userId: string,
  code: string,
  newPassword: string
) => {
  const passwordResult = passwordSchema.safeParse(newPassword);
  if (!passwordResult.success) {
    throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
  }

  const codeResult = await checkPasswordResetCode(`password-change:${userId}`, code, true);
  if (codeResult !== 'valid') {
    throw new Error('Неверный или просроченный код');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: 'Пароль успешно изменён' };
};

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ — НЕ ТРЕБУЮТ АВТОРИЗАЦИИ)
// ============================================================

// 1. Запрос кода восстановления
export const requestPasswordReset = async (email: string) => {
  const user = await findUserByEmailIdentity(email);
  const response = { message: 'Если аккаунт существует, код для восстановления отправлен на почту' };
  if (!user?.passwordHash) return response;

  const code = generatePasswordResetCode();
  const issueResult = await issuePasswordResetCode(user.id, code);
  if (issueResult === 'issued') {
    await sendPasswordResetEmail(user.email, code);
  }
  return response;
};

// 2. Проверка кода восстановления
export const verifyResetCode = async (email: string, code: string) => {
  const user = await findUserByEmailIdentity(email);
  const result = user?.passwordHash
    ? await checkPasswordResetCode(user.id, code, false)
    : 'expired';
  if (result !== 'valid') {
    throw new Error('Неверный или просроченный код');
  }

  return { message: 'Код подтверждён' };
};

// 3. Установка нового пароля
export const confirmResetPassword = async (
  email: string,
  code: string,
  newPassword: string
) => {
  const passwordResult = passwordSchema.safeParse(newPassword);
  if (!passwordResult.success) {
    throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
  }

  const user = await findUserByEmailIdentity(email);
  if (!user?.passwordHash) throw new Error('Неверный или просроченный код');

  const result = await checkPasswordResetCode(user.id, code, true);
  if (result !== 'valid') {
    throw new Error('Неверный или просроченный код');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  return { message: 'Пароль успешно изменён' };
};

// ============================================================
// ГЕНЕРАЦИЯ JWT ТОКЕНА (используется для OAuth)
// ============================================================
export const generateToken = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new Error('Пользователь не найден');
  return jwt.sign(
    { id: userId, cv: credentialVersion(user.passwordHash) },
    getJwtSecret(),
    { expiresIn: jwtExpiresIn() }
  );
};
