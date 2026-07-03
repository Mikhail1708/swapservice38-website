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
  confirmPasswordChange
} from '../services/auth.service';

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

    // Находим корзину гостя
    const guestCart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!guestCart || !guestCart.items || (guestCart.items as any[]).length === 0) {
      console.log('ℹ️ Корзина гостя пуста');
      return;
    }

    const guestItems = guestCart.items as any[];
    console.log(`📦 Товаров в гостевой корзине: ${guestItems.length}`);

    // Находим корзину пользователя
    let userCart = await prisma.cart.findUnique({
      where: { userId: userId },
    });

    if (userCart) {
      // Объединяем корзины
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
      // Создаём корзину пользователя с товарами гостя
      await prisma.cart.create({
        data: {
          userId: userId,
          items: guestItems,
        },
      });
      console.log(`✅ Создана корзина пользователя, ${guestItems.length} товаров`);
    }

    // Удаляем корзину гостя
    await prisma.cart.delete({
      where: { guestId: guestId },
    });

    console.log(`✅ Корзина успешно перенесена!`);
  } catch (error) {
    console.error('❌ Ошибка переноса корзины:', error);
  }
};

// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ
// ============================================================

export const registerController = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const result = await register(email, password, firstName, lastName);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const verifyController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await verifyEmail(email, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await login(email, password);

    // ✅ Получаем guestId из cookies
    const guestId = req.cookies?.guestId;

    // ✅ Переносим корзину
    if (guestId) {
      await mergeCart(user.id, guestId);
      // Удаляем guestId cookie
      res.clearCookie('guestId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const logoutController = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ message: 'Выход выполнен' });
};

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
// ПРОФИЛЬ
// ============================================================

export const updateProfileController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { firstName, lastName, phone, address } = req.body;
    const result = await updateProfile(userId, { firstName, lastName, phone, address });
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