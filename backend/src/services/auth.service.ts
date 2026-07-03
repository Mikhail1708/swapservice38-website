import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import redis from '../config/redis';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail } from './email.service';

const prisma = new PrismaClient();

// Генерация 6-значного кода
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Регистрация
export const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
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
      isVerified: false,
      role: 'user',
    },
  });

  const code = generateCode();
  await redis.setex(`verify:${email}`, 600, code);

  await sendVerificationEmail(email, code);

  return { message: 'Код отправлен на почту' };
};

// Подтверждение email
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

// Логин
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
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return { 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      firstName: user.firstName, 
      lastName: user.lastName, 
      role: user.role 
    } 
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
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

// Восстановление пароля - отправка кода
export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Пользователь с таким email не найден');
  }

  const code = generateCode();
  await redis.setex(`reset:${email}`, 900, code);

  await sendPasswordResetEmail(email, code);
  return { message: 'Код для восстановления отправлен на почту' };
};

// Восстановление пароля - подтверждение кода и установка нового пароля
export const resetPassword = async (email: string, code: string, newPassword: string) => {
  const stored = await redis.get(`reset:${email}`);
  if (!stored || stored !== code) {
    throw new Error('Неверный или просроченный код');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  await redis.del(`reset:${email}`);
  return { message: 'Пароль успешно изменён' };
};

// ===== НОВЫЕ ФУНКЦИИ =====

// Обновление профиля
export const updateProfile = async (userId: string, data: { firstName?: string; lastName?: string; phone?: string; address?: string }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      address: data.address,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      role: true,
      isVerified: true,
    },
  });

  return { user: updated, message: 'Профиль обновлён' };
};

// Смена пароля с текущим паролем
export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash!);
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

// Запрос на смену пароля через почту
export const requestPasswordChange = async (userId: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  if (user.email !== email) {
    throw new Error('Email не совпадает с email пользователя');
  }

  const code = generateCode();
  await redis.setex(`change-password:${userId}`, 900, code);

  await sendPasswordChangeEmail(email, code);

  return { message: 'Код подтверждения отправлен на почту' };
};

// Подтверждение смены пароля
export const confirmPasswordChange = async (userId: string, code: string, newPassword: string) => {
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
import jwt from 'jsonwebtoken';

// Генерация JWT токена (используется для OAuth)
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};