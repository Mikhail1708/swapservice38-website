// backend/src/schemas/auth.schema.ts
import { z } from 'zod';
import { emailSchema, passwordSchema, optionalNameSchema, codeSchema } from './common.schema';
import { personalDataAcceptanceSchema } from '../services/consent.service';

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export const registerSchema = z.object({
  personalDataConsent: personalDataAcceptanceSchema,
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
  email: emailSchema.optional(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  code: codeSchema,
}).refine((data) => Boolean(data.email) !== Boolean(data.token), { message: 'Укажите ссылку подтверждения или email' });

export const verificationContextSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const resendVerificationSchema = z.object({
  email: emailSchema.optional(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).refine((data) => Boolean(data.email) !== Boolean(data.token), { message: 'Укажите ссылку подтверждения или email' });

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
