// backend/src/services/auth.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import redis from '@config/redis';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail } from './email.service';
import {
  checkPasswordResetCode,
  generatePasswordResetCode,
  issuePasswordResetCode,
} from './passwordResetSecurity.service';

const prisma = new PrismaClient();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
};

const jwtExpiresIn = (): SignOptions['expiresIn'] =>
  (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

// Генерация 6-значного кода
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

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
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Пользователь с таким email уже зарегистрирован');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      middleName, // ✅ ОТЧЕСТВО
      isVerified: false,
      role: 'user',
    },
  });

  const code = generateCode();
  await redis.setex(`verify:${email}`, 600, code);

  await sendVerificationEmail(email, code);

  return { message: 'Код отправлен на почту' };
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
export const verifyEmail = async (email: string, code: string) => {
  const stored = await redis.get(`verify:${email}`);
  if (!stored || stored !== code) {
    throw new Error('Неверный или просроченный код');
  }

  await prisma.user.update({
    where: { email },
    data: { isVerified: true },
  });

  await redis.del(`verify:${email}`);

  return { message: 'Email подтверждён' };
};

// ============================================================
// ЛОГИН
// ============================================================
export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Неверный email или пароль');
  }
  if (!user.isVerified) {
    throw new Error('Email не подтверждён');
  }

  const valid = await bcrypt.compare(password, user.passwordHash!);
  if (!valid) {
    throw new Error('Неверный email или пароль');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
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

  if (user.email !== email) {
    throw new Error('Email не совпадает с email пользователя');
  }

  if (!user.passwordHash) {
    throw new Error('У этого аккаунта нет пароля (используйте OAuth)');
  }

  const code = generateCode();
  await redis.setex(`change-password:${userId}`, 900, code);

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
  const stored = await redis.get(`change-password:${userId}`);
  if (!stored || stored !== code) {
    throw new Error('Неверный или просроченный код');
  }

  if (newPassword.length < 8) {
    throw new Error('Пароль должен быть минимум 8 символов');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await redis.del(`change-password:${userId}`);
  return { message: 'Пароль успешно изменён' };
};

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ — НЕ ТРЕБУЮТ АВТОРИЗАЦИИ)
// ============================================================

// 1. Запрос кода восстановления
export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const response = { message: 'Если аккаунт существует, код для восстановления отправлен на почту' };
  if (!user?.passwordHash) return response;

  const code = generatePasswordResetCode();
  const issueResult = await issuePasswordResetCode(email, code);
  if (issueResult === 'issued') {
    await sendPasswordResetEmail(email, code);
  }
  return response;
};

// 2. Проверка кода восстановления
export const verifyResetCode = async (email: string, code: string) => {
  const result = await checkPasswordResetCode(email, code, false);
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
  if (newPassword.length < 8) {
    throw new Error('Пароль должен быть минимум 8 символов');
  }

  const result = await checkPasswordResetCode(email, code, true);
  if (result !== 'valid') {
    throw new Error('Неверный или просроченный код');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });
  return { message: 'Пароль успешно изменён' };
};

// ============================================================
// ГЕНЕРАЦИЯ JWT ТОКЕНА (используется для OAuth)
// ============================================================
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    getJwtSecret(),
    { expiresIn: jwtExpiresIn() }
  );
};
