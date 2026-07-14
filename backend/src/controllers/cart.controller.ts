// backend/src/controllers/cart.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Тип для товара из CRM
interface CRMProduct {
  id: number;
  name: string;
  price: number;
  sku?: string;
  images?: string[];
  inStock?: boolean;
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ — ПОЛУЧЕНИЕ ТОВАРА ИЗ CRM
// ============================================================
const getProductFromCRM = async (productId: string): Promise<CRMProduct | null> => {
  try {
    const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
    const response = await fetch(`${crmApiUrl}/api/public/products/${productId}`, {
      timeout: 5000,
    });

    if (!response.ok) {
      console.error('❌ Товар не найден в CRM:', productId);
      return null;
    }

    return await response.json() as CRMProduct;
  } catch (error) {
    console.error('❌ Ошибка получения товара из CRM:', error);
    return null;
  }
};

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ — ФОРМАТИРОВАНИЕ ОТВЕТА КОРЗИНЫ
// ============================================================
const formatCartResponse = (cart: any) => {
  const items = Array.isArray(cart.items) ? cart.items : [];
  const total = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const itemsCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

  return {
    cart: {
      id: cart.id,
      items: items,
      total: total,
      itemsCount: itemsCount,
    },
  };
};

// ============================================================
// ПОЛУЧЕНИЕ КОРЗИНЫ
// ============================================================
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    console.log('📦 GET /api/cart:', { userId, guestId });

    let cart = null;

    // ✅ 1. ЕСЛИ ЕСТЬ userId — ИЩЕМ КОРЗИНУ ПОЛЬЗОВАТЕЛЯ
    if (userId) {
      console.log('🔍 Ищем корзину для userId:', userId);

      cart = await prisma.cart.findUnique({
        where: { userId: String(userId) },
      });

      // ✅ 2. ЕСЛИ НЕТ КОРЗИНЫ У ПОЛЬЗОВАТЕЛЯ, НО ЕСТЬ guestId — ПЕРЕНОСИМ
      if (!cart && guestId) {
        console.log(`🔄 Перенос корзины: guestId=${guestId} -> userId=${userId}`);

        const guestCart = await prisma.cart.findUnique({
          where: { guestId: guestId },
        });

        if (guestCart && guestCart.items && (guestCart.items as any[]).length > 0) {
          // Создаём корзину пользователя с товарами гостя
          cart = await prisma.cart.create({
            data: {
              userId: String(userId),
              items: guestCart.items,
            },
          });

          // Удаляем корзину гостя
          await prisma.cart.delete({
            where: { guestId: guestId },
          });

          // Удаляем guestId cookie
          res.clearCookie('guestId', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
          });

          console.log(`✅ Корзина перенесена, товаров: ${(guestCart.items as any[]).length}`);
        } else {
          // Корзина гостя пуста — создаём пустую корзину пользователя
          cart = await prisma.cart.create({
            data: {
              userId: String(userId),
              items: [],
            },
          });
          console.log('🆕 Создана пустая корзина для пользователя (перенос пустой)');
        }
      }

      // ✅ 3. ЕСЛИ ВСЁ РАВНО НЕТ КОРЗИНЫ — СОЗДАЁМ ПУСТУЮ
      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId: String(userId),
            items: [],
          },
        });
        console.log('🆕 Создана пустая корзина для пользователя (новый)');
      }
    }
    // ✅ 4. ЕСЛИ НЕТ userId, НО ЕСТЬ guestId — ИЩЕМ КОРЗИНУ ГОСТЯ
    else if (guestId) {
      console.log('🔍 Ищем корзину для guestId:', guestId);

      cart = await prisma.cart.findUnique({
        where: { guestId: guestId },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            guestId: guestId,
            items: [],
          },
        });
        console.log('🆕 Создана пустая корзина для гостя');
      }
    }
    // ✅ 5. НЕТ НИ userId, НИ guestId — СОЗДАЁМ НОВОГО ГОСТЯ
    else {
      guestId = uuidv4();
      cart = await prisma.cart.create({
        data: {
          guestId: guestId,
          items: [],
        },
      });

      res.cookie('guestId', guestId, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      console.log('🆕 Создан новый guestId:', guestId);
    }

    res.json(formatCartResponse(cart));
  } catch (error) {
    console.error('❌ Get cart error:', error);
    res.status(500).json({ error: 'Ошибка получения корзины' });
  }
};

// ============================================================
// ДОБАВЛЕНИЕ В КОРЗИНУ
// ============================================================
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    console.log('🛒 Добавление в корзину:', { productId, quantity, userId, guestId });

    // ✅ 1. ЕСЛИ ЕСТЬ userId — ИСПОЛЬЗУЕМ ЕГО
    if (userId) {
      console.log('🔍 Добавление для userId:', userId);

      let cart = await prisma.cart.findUnique({
        where: { userId: String(userId) },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId: String(userId),
            items: [],
          },
        });
        console.log('🆕 Создана корзина для пользователя');
      }

      let items = Array.isArray(cart.items) ? cart.items : [];

      // Проверяем, есть ли уже такой товар
      const existingItemIndex = items.findIndex(
        (item) => String(item.productId) === String(productId)
      );

      if (existingItemIndex !== -1) {
        items[existingItemIndex].quantity += quantity;
        console.log('🔄 Обновлено количество:', productId, '->', items[existingItemIndex].quantity);
      } else {
        const product = await getProductFromCRM(productId);
        if (!product) {
          res.status(404).json({ error: 'Товар не найден' });
          return;
        }

        items.push({
          productId: String(productId),
          name: product.name || 'Товар',
          price: product.price || 0,
          quantity: quantity,
          image: product.images?.[0] || '/images/logo/logo.png',
          sku: product.sku || null,
        });
        console.log('➕ Добавлен новый товар:', productId);
      }

      const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: { items: items },
      });

      res.json(formatCartResponse(updatedCart));
      return;
    }

    // ✅ 2. НЕТ userId — РАБОТАЕМ С guestId
    if (!guestId) {
      guestId = uuidv4();
      res.cookie('guestId', guestId, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      console.log('🆕 Создан новый guestId:', guestId);
    }

    console.log('🔍 Добавление для guestId:', guestId);

    let cart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          guestId: guestId,
          items: [],
        },
      });
      console.log('🆕 Создана корзина для гостя');
    }

    let items = Array.isArray(cart.items) ? cart.items : [];

    const existingItemIndex = items.findIndex(
      (item) => String(item.productId) === String(productId)
    );

    if (existingItemIndex !== -1) {
      items[existingItemIndex].quantity += quantity;
      console.log('🔄 Обновлено количество:', productId, '->', items[existingItemIndex].quantity);
    } else {
      const product = await getProductFromCRM(productId);
      if (!product) {
        res.status(404).json({ error: 'Товар не найден' });
        return;
      }

      items.push({
        productId: String(productId),
        name: product.name || 'Товар',
        price: product.price || 0,
        quantity: quantity,
        image: product.images?.[0] || '/images/logo/logo.png',
        sku: product.sku || null,
      });
      console.log('➕ Добавлен новый товар:', productId);
    }

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: { items: items },
    });

    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error('❌ Add to cart error:', error);
    res.status(500).json({ error: 'Ошибка добавления в корзину' });
  }
};

// ============================================================
// ОБНОВЛЕНИЕ КОЛИЧЕСТВА
// ============================================================
export const updateCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    const userId = (req as any).user?.id;
    const guestId = req.cookies?.guestId;

    console.log('🔄 Обновление корзины:', { productId, quantity, userId, guestId });

    if (!userId && !guestId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    let cart = null;
    if (userId) {
      cart = await prisma.cart.findUnique({
        where: { userId: String(userId) },
      });
    } else if (guestId) {
      cart = await prisma.cart.findUnique({
        where: { guestId: guestId },
      });
    }

    if (!cart) {
      console.log('❌ Корзина не найдена');
      res.status(404).json({ error: 'Корзина не найдена' });
      return;
    }

    let items = Array.isArray(cart.items) ? cart.items : [];

    if (quantity === 0) {
      // Удаляем товар
      items = items.filter((item) => String(item.productId) !== String(productId));
      console.log('🗑️ Товар удалён из корзины:', productId);
    } else {
      // Обновляем количество
      const existingItemIndex = items.findIndex(
        (item) => String(item.productId) === String(productId)
      );
      if (existingItemIndex !== -1) {
        items[existingItemIndex].quantity = quantity;
        console.log('🔄 Количество обновлено:', productId, '->', quantity);
      } else {
        res.status(404).json({ error: 'Товар не найден в корзине' });
        return;
      }
    }

    let updatedCart;
    if (userId) {
      updatedCart = await prisma.cart.update({
        where: { userId: String(userId) },
        data: { items: items },
      });
    } else {
      updatedCart = await prisma.cart.update({
        where: { guestId: guestId },
        data: { items: items },
      });
    }

    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error('❌ Update cart error:', error);
    res.status(500).json({ error: 'Ошибка обновления корзины' });
  }
};

// ============================================================
// ОЧИСТКА КОРЗИНЫ
// ============================================================
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const guestId = req.cookies?.guestId;

    console.log('🧹 Очистка корзины:', { userId, guestId });

    if (!userId && !guestId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    let updatedCart;
    if (userId) {
      updatedCart = await prisma.cart.update({
        where: { userId: String(userId) },
        data: { items: [] },
      });
      console.log('✅ Корзина очищена для userId:', userId);
    } else if (guestId) {
      updatedCart = await prisma.cart.update({
        where: { guestId: guestId },
        data: { items: [] },
      });
      console.log('✅ Корзина очищена для guestId:', guestId);
    } else {
      res.status(400).json({ error: 'Не удалось определить корзину' });
      return;
    }

    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error('❌ Clear cart error:', error);
    res.status(500).json({ error: 'Ошибка очистки корзины' });
  }
};