// backend/src/schemas/auth.schema.ts
import { z } from 'zod';
import { emailSchema, passwordSchema, optionalNameSchema, codeSchema } from './common.schema';

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  middleName: optionalNameSchema,
});

// ============================================================
// ЛОГИН
// ============================================================
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль'),
});

// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
export const verifySchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

// ============================================================
// СМЕНА ПАРОЛЯ (АВТОРИЗОВАННЫЙ)
// ============================================================
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: passwordSchema,
});

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================
export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const resetPasswordVerifySchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

export const resetPasswordConfirmSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  newPassword: passwordSchema,
});

// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
export const updateProfileSchema = z.object({
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  middleName: optionalNameSchema,
  phone: z.string().optional(),
  address: z.string().optional(),
});
