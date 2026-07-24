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
  retail_price?: number;
  sku?: string;
  stock: number;
  images?: string[];
  inStock?: boolean;
}

// ============================================================
// ПОЛУЧЕНИЕ ТОВАРА ИЗ CRM С ОСТАТКОМ
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

    const data = await response.json();
    
    // Нормализуем данные
    return {
      id: data.id || data.productId,
      name: data.name || 'Товар',
      price: data.price || data.retail_price || 0,
      retail_price: data.retail_price || data.price || 0,
      sku: data.sku || data.article || null,
      stock: data.stock || 0,
      images: data.images || [],
      inStock: data.inStock !== undefined ? data.inStock : (data.stock || 0) > 0,
    };
  } catch (error) {
    console.error('❌ Ошибка получения товара из CRM:', error);
    return null;
  }
};

// ============================================================
// ФОРМАТИРОВАНИЕ ОТВЕТА КОРЗИНЫ
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

    if (userId) {
      cart = await prisma.cart.findUnique({
        where: { userId: String(userId) },
      });

      if (!cart && guestId) {
        console.log(`🔄 Перенос корзины: guestId=${guestId} -> userId=${userId}`);

        const guestCart = await prisma.cart.findUnique({
          where: { guestId: guestId },
        });

        if (guestCart && guestCart.items && (guestCart.items as any[]).length > 0) {
          cart = await prisma.cart.create({
            data: {
              userId: String(userId),
              items: guestCart.items,
            },
          });

          await prisma.cart.delete({
            where: { guestId: guestId },
          });

          res.clearCookie('guestId', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
          });

          console.log(`✅ Корзина перенесена, товаров: ${(guestCart.items as any[]).length}`);
        } else {
          cart = await prisma.cart.create({
            data: {
              userId: String(userId),
              items: [],
            },
          });
          console.log('🆕 Создана пустая корзина для пользователя (перенос пустой)');
        }
      }

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId: String(userId),
            items: [],
          },
        });
        console.log('🆕 Создана пустая корзина для пользователя (новый)');
      }
    } else if (guestId) {
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
    } else {
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
// ДОБАВЛЕНИЕ В КОРЗИНУ — С ПРОВЕРКОЙ ОСТАТКА
// ============================================================
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    console.log('🛒 Добавление в корзину:', { productId, quantity, userId, guestId });

    // ✅ 1. ПОЛУЧАЕМ ТОВАР ИЗ CRM С ОСТАТКОМ
    const product = await getProductFromCRM(productId);
    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    const availableStock = product.stock || 0;
    console.log(`📦 Остаток товара ${productId}: ${availableStock} шт.`);

    if (availableStock <= 0) {
      res.status(400).json({ 
        error: 'Товар отсутствует на складе',
        code: 'OUT_OF_STOCK',
        availableStock: 0,
      });
      return;
    }

    // ✅ 2. НАХОДИМ ИЛИ СОЗДАЁМ КОРЗИНУ
    let cart = null;
    let currentItems: any[] = [];

    if (userId) {
      cart = await prisma.cart.findUnique({
        where: { userId: String(userId) },
      });
    } else {
      if (!guestId) {
        guestId = uuidv4();
        res.cookie('guestId', guestId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      }
      cart = await prisma.cart.findUnique({
        where: { guestId: guestId },
      });
    }

    if (!cart) {
      if (userId) {
        cart = await prisma.cart.create({
          data: {
            userId: String(userId),
            items: [],
          },
        });
      } else {
        cart = await prisma.cart.create({
          data: {
            guestId: guestId,
            items: [],
          },
        });
      }
      console.log('🆕 Создана новая корзина');
    }

    currentItems = Array.isArray(cart.items) ? cart.items : [];

    // ✅ 3. СЧИТАЕМ СКОЛЬКО УЖЕ В КОРЗИНЕ ЭТОГО ТОВАРА
    const existingItemIndex = currentItems.findIndex(
      (item) => String(item.productId) === String(productId)
    );
    const currentQuantity = existingItemIndex !== -1 ? currentItems[existingItemIndex].quantity : 0;
    const newQuantity = currentQuantity + quantity;

    // ✅ 4. ПРОВЕРЯЕМ ЧТО НЕ ПРЕВЫШАЕМ ОСТАТОК
    if (newQuantity > availableStock) {
      const maxAvailable = availableStock - currentQuantity;
      res.status(400).json({ 
        error: `Недостаточно товара на складе. Доступно: ${availableStock} шт., в корзине: ${currentQuantity} шт.`,
        code: 'STOCK_LIMIT_EXCEEDED',
        availableStock,
        currentQuantity,
        maxAvailable: Math.max(0, maxAvailable),
        productId,
      });
      return;
    }

    // ✅ 5. ОБНОВЛЯЕМ КОРЗИНУ
    if (existingItemIndex !== -1) {
      currentItems[existingItemIndex].quantity = newQuantity;
      console.log('🔄 Обновлено количество:', productId, '->', newQuantity);
    } else {
      currentItems.push({
        productId: String(productId),
        name: product.name || 'Товар',
        price: product.price || 0,
        quantity: quantity,
        image: product.images?.[0] || '/images/logo/logo.png',
        sku: product.sku || null,
        maxStock: availableStock, // ✅ СОХРАНЯЕМ МАКСИМАЛЬНЫЙ ОСТАТОК
      });
      console.log('➕ Добавлен новый товар:', productId);
    }

    let updatedCart;
    if (userId) {
      updatedCart = await prisma.cart.update({
        where: { userId: String(userId) },
        data: { items: currentItems },
      });
    } else {
      updatedCart = await prisma.cart.update({
        where: { guestId: guestId },
        data: { items: currentItems },
      });
    }

    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error('❌ Add to cart error:', error);
    res.status(500).json({ error: 'Ошибка добавления в корзину' });
  }
};

// ============================================================
// ОБНОВЛЕНИЕ КОЛИЧЕСТВА — С ПРОВЕРКОЙ ОСТАТКА
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

    // ✅ 1. ПОЛУЧАЕМ ТОВАР ИЗ CRM С ОСТАТКОМ
    const product = await getProductFromCRM(productId);
    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    const availableStock = product.stock || 0;
    console.log(`📦 Остаток товара ${productId}: ${availableStock} шт.`);

    // ✅ 2. НАХОДИМ КОРЗИНУ
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

    // ✅ 3. НАХОДИМ ТОВАР В КОРЗИНЕ
    const existingItemIndex = items.findIndex(
      (item) => String(item.productId) === String(productId)
    );

    if (existingItemIndex === -1) {
      res.status(404).json({ error: 'Товар не найден в корзине' });
      return;
    }

    // ✅ 4. ЕСЛИ quantity === 0 — УДАЛЯЕМ
    if (quantity === 0) {
      items.splice(existingItemIndex, 1);
      console.log('🗑️ Товар удалён из корзины:', productId);
      
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
      return;
    }

    // ✅ 5. ПРОВЕРЯЕМ ЧТО НЕ ПРЕВЫШАЕМ ОСТАТОК
    if (quantity > availableStock) {
      res.status(400).json({ 
        error: `Недостаточно товара на складе. Доступно: ${availableStock} шт.`,
        code: 'STOCK_LIMIT_EXCEEDED',
        availableStock,
        requestedQuantity: quantity,
        productId,
      });
      return;
    }

    // ✅ 6. ОБНОВЛЯЕМ КОЛИЧЕСТВО
    items[existingItemIndex].quantity = quantity;
    console.log('🔄 Количество обновлено:', productId, '->', quantity);

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