import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import redis from '../config/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service';

const prisma = new PrismaClient();

// Генерация 6-значного кода
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Регистрация
export const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
  // Проверяем, существует ли пользователь
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Пользователь с таким email уже зарегистрирован');
  }

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(password, 10);

  // Создаём пользователя (неверифицированного)
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

  // Генерируем код и сохраняем в Redis (TTL 10 минут)
  const code = generateCode();
  await redis.setex(`verify:${email}`, 600, code);

  // Отправляем письмо с кодом
  await sendVerificationEmail(email, code);

  return { message: 'Код отправлен на почту' };
};

// Подтверждение email
export const verifyEmail = async (email: string, code: string) => {
  const stored = await redis.get(`verify:${email}`);
  if (!stored || stored !== code) {
    throw new Error('Неверный или просроченный код');
  }

  // Обновляем пользователя
  await prisma.user.update({
    where: { email },
    data: { isVerified: true },
  });

  // Удаляем код из Redis
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

  // Генерируем JWT
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

// Получение пользователя по ID
export const getUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: { 
      id: true, 
      email: true, 
      firstName: true, 
      lastName: true, 
      phone: true, 
      address: true, 
      role: true, 
      isVerified: true 
    },
  });
};

// Восстановление пароля - отправка кода
export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Пользователь с таким email не найден');
  }

  const code = generateCode();
  await redis.setex(`reset:${email}`, 900, code); // 15 минут

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