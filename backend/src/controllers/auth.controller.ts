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
  confirmResetPassword
} from '../services/auth.service';
import { sendVerificationEmail } from '../services/email.service';
import redis from '@config/redis';
import { log } from '../config/logger';

const prisma = new PrismaClient();

// ============================================================
// ПЕРЕНОС КОРЗИНЫ ПРИ АВТОРИЗАЦИИ
// ============================================================
export const mergeCart = async (userId: string, guestId: string | undefined) => {
  if (!guestId) {
    console.log('ℹ️ Нет guestId, корзина не переносится');
    return;
  }

  try {
    console.log(`🔄 Перенос корзины: guestId=${guestId} -> userId=${userId}`);

    const guestCart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!guestCart || !guestCart.items || (guestCart.items as any[]).length === 0) {
      console.log('ℹ️ Корзина гостя пуста');
      return;
    }

    const guestItems = guestCart.items as any[];
    console.log(`📦 Товаров в гостевой корзине: ${guestItems.length}`);

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
          console.log(`🔄 Обновлено количество: ${guestItem.name} -> ${mergedItems[existingIndex].quantity}`);
        } else {
          mergedItems.push(guestItem);
          console.log(`➕ Добавлен товар: ${guestItem.name}`);
        }
      }

      await prisma.cart.update({
        where: { userId: userId },
        data: { items: mergedItems },
      });
      console.log(`✅ Корзина пользователя обновлена, ${mergedItems.length} товаров`);
    } else {
      await prisma.cart.create({
        data: {
          userId: userId,
          items: guestItems,
        },
      });
      console.log(`✅ Создана корзина пользователя, ${guestItems.length} товаров`);
    }

    await prisma.cart.delete({
      where: { guestId: guestId },
    });

    console.log(`✅ Корзина успешно перенесена!`);
  } catch (error) {
    console.error('❌ Ошибка переноса корзины:', error);
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
      console.log(`🔄 Перенос корзины при логине: guestId=${guestId} -> userId=${user.id}`);
      await mergeCart(user.id, guestId);

      res.clearCookie('guestId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    console.log('✅ Логин успешен, токен установлен');
    res.json({ user });
  } catch (error: any) {
    console.error('❌ Ошибка логина:', error);
    res.status(401).json({ error: error.message });
  }
};

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export const registerController = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, middleName } = req.body; // ✅ middleName
    const result = await register(email, password, firstName, lastName, middleName);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
export const verifyController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await verifyEmail(email, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ============================================================
// ПОВТОРНАЯ ОТПРАВКА КОДА
// ============================================================
export const resendVerificationController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email уже подтверждён' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.setex(`verify:${email}`, 600, code);

    await sendVerificationEmail(email, code);

    console.log(`📧 Код подтверждения отправлен повторно на ${email}`);
    res.json({ message: 'Код отправлен повторно' });
  } catch (error: any) {
    console.error('❌ Ошибка повторной отправки кода:', error);
    res.status(400).json({ error: error.message || 'Ошибка отправки кода' });
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
    res.status(500).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
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
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
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
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
  }
};

export const confirmResetPasswordController = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await confirmResetPassword(email, code, newPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
