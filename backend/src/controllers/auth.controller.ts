// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import {
  register,
  verifyEmail,
  login,
  getUserById,
  updateProfile,
  changePassword,
  requestPasswordChange,
  confirmPasswordChange,
  requestPasswordReset,
  verifyResetCode,
  confirmResetPassword,
  generateToken,
  resendVerification,
  getVerificationContext,
} from '../services/auth.service';
import { AppError } from '../middleware/error.middleware';
import { CONSENT_DOCUMENTS, findPersonalDataConsent } from '../services/consent.service';
import { log } from '../config/logger';

const prisma = new PrismaClient();

export const consentDocumentsController = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ documents: CONSENT_DOCUMENTS });
};

export const consentStatusController = async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Необходимо авторизоваться' });
  try {
    const consent = await findPersonalDataConsent(prisma, userId);
    res.json({ documents: CONSENT_DOCUMENTS, requiresPersonalDataConsent: !consent });
  } catch {
    res.status(503).json({ code: 'CONSENT_UNAVAILABLE', error: 'Не удалось проверить согласия. Попробуйте позже' });
  }
};

const AUTH_BUSINESS_ERRORS = [
  'Неверный или просроченный код',
  'Пользователь не найден',
  'Неверный текущий пароль',
  'Email не совпадает с email пользователя',
  'У этого аккаунта нет пароля (используйте OAuth)',
  'Новый код можно запросить позже',
];

const sendAuthError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    if (error.statusCode === 429 && error.details?.retryAfter) res.setHeader('Retry-After', String(error.details.retryAfter));
    return res.status(error.statusCode).json({ code: error.code, error: error.message, details: error.details });
  }
  const message = error instanceof Error ? error.message : '';
  const isPasswordValidation = /парол|латин|заглавн|строчн|цифр|символ/i.test(message);
  if (AUTH_BUSINESS_ERRORS.includes(message) || isPasswordValidation) {
    return res.status(400).json({ code: 'AUTH_VALIDATION_ERROR', error: message });
  }
  log.error('Authentication operation failed', { errorName: error instanceof Error ? error.name : 'unknown' });
  return res.status(503).json({ code: 'AUTH_UNAVAILABLE', error: fallback });
};

// ============================================================
// ПЕРЕНОС КОРЗИНЫ ПРИ АВТОРИЗАЦИИ
// ============================================================
export const mergeCart = async (userId: string, guestId: string | undefined) => {
  if (!guestId) return true;

  try {
    const guestCart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!guestCart || !guestCart.items || (guestCart.items as any[]).length === 0) {
      return true;
    }

    const guestItems = guestCart.items as any[];

    let userCart = await prisma.cart.findUnique({
      where: { userId: userId },
    });

    if (userCart) {
      const userItems = userCart.items as any[];
      const mergedItems = [...userItems];

      for (const guestItem of guestItems) {
        const existingIndex = mergedItems.findIndex(
          (item) => String(item.productId) === String(guestItem.productId)
        );

        if (existingIndex !== -1) {
          mergedItems[existingIndex].quantity += guestItem.quantity;
        } else {
          mergedItems.push(guestItem);
        }
      }

      await prisma.cart.update({
        where: { userId: userId },
        data: { items: mergedItems },
      });
    } else {
      await prisma.cart.create({
        data: {
          userId: userId,
          items: guestItems,
        },
      });
    }

    await prisma.cart.delete({
      where: { guestId: guestId },
    });
    return true;

  } catch (error) {
    log.error('Cart merge failed', { userId, error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
};

// ============================================================
// ЛОГИН — ПЕРЕНОС КОРЗИНЫ
// ============================================================
export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await login(email, password);

    const guestId = req.cookies?.guestId;

    if (guestId) {
      const cartMerged = await mergeCart(user.id, guestId);
      if (cartMerged) {
        res.clearCookie('guestId', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ user });
  } catch (error: any) {
    if (error.code === 'EMAIL_UNVERIFIED') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ code: 'EMAIL_UNVERIFIED', error: 'Email не подтверждён', verificationToken: error.verificationToken });
    }
    res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль' });
  }
};

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export const registerController = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, middleName } = req.body; // ✅ middleName
    const result = await register(email, password, firstName, lastName, middleName, req.body.personalDataConsent);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json(result);
  } catch (error: any) {
    if (error?.message === 'Пользователь с таким email уже зарегистрирован') {
      return res.status(409).json({ code: 'EMAIL_ALREADY_REGISTERED', error: error.message });
    }
    if (error instanceof AppError) return sendAuthError(res, error, 'Не удалось зарегистрироваться');
    log.error('Registration failed', { errorName: error instanceof Error ? error.name : 'unknown' });
    res.status(503).json({ code: 'REGISTRATION_UNAVAILABLE', error: 'Регистрация временно недоступна. Попробуйте позже' });
  }
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
export const verifyController = async (req: Request, res: Response) => {
  try {
    const { email, code, token } = req.body;
    if ((!email && !token) || (email && token)) return res.status(400).json({ error: 'Укажите ссылку подтверждения или email' });
    const result = await verifyEmail(email, code, token);
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось подтвердить email. Попробуйте позже');
  }
};

// ============================================================
// ПОВТОРНАЯ ОТПРАВКА КОДА
// ============================================================
export const resendVerificationController = async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;
    if ((!email && !token) || (email && token)) return res.status(400).json({ error: 'Укажите ссылку подтверждения или email' });
    const result = await resendVerification(email, token);
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось отправить письмо. Попробуйте позже');
  }
};

export const verificationContextController = async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json(await getVerificationContext(req.body.token));
  } catch (error) {
    sendAuthError(res, error, 'Не удалось проверить ссылку. Попробуйте позже');
  }
};

// ============================================================
// ВЫХОД
// ============================================================
export const logoutController = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: 'Выход выполнен' });
};

// ============================================================
// ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const meController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    const user = await getUserById(userId);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName, // ✅ ОТЧЕСТВО
        phone: user.phone,
        address: user.address,
        role: user.role,
        isVerified: user.isVerified,
        yandexId: user.yandexId,
        maxId: user.maxId,
      }
    });
  } catch (error: any) {
    log.error('Current user lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ code: 'AUTH_UNAVAILABLE', error: 'Не удалось проверить сессию' });
  }
};

// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
export const updateProfileController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { firstName, lastName, middleName, phone, address } = req.body; // ✅ middleName
    const result = await updateProfile(userId, {
      firstName,
      lastName,
      middleName, // ✅ ОТЧЕСТВО
      phone,
      address
    });
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось сохранить изменения. Попробуйте позже');
  }
};

// ============================================================
// СМЕНА ПАРОЛЯ
// ============================================================
export const changePasswordController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(userId, currentPassword, newPassword);
    const token = await generateToken(userId);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
  }
};

export const requestPasswordChangeController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { email } = req.body;
    const result = await requestPasswordChange(userId, email);
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось отправить код. Попробуйте позже');
  }
};

export const confirmPasswordChangeController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { code, newPassword } = req.body;
    const result = await confirmPasswordChange(userId, code, newPassword);
    const token = await generateToken(userId);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
  }
};

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================

export const requestPasswordResetController = async (req: Request, res: Response) => {
  const genericResponse = { message: 'Если аккаунт существует, код для восстановления отправлен на почту' };
  try {
    const { email } = req.body;
    await requestPasswordReset(email);
    res.json(genericResponse);
  } catch (error: any) {
    // Do not expose account existence or provider failures through this public endpoint.
    log.error('Password reset request failed', { error: error.message });
    res.json(genericResponse);
  }
};

export const verifyResetCodeController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await verifyResetCode(email, code);
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось проверить код. Попробуйте позже');
  }
};

export const confirmResetPasswordController = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await confirmResetPassword(email, code, newPassword);
    res.json(result);
  } catch (error: any) {
    sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
  }
};
