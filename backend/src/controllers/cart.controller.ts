// backend/src/controllers/cart.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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

// Получение корзины
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const guestId = req.cookies?.guestId;

    console.log('📦 GET /api/cart:', { userId, guestId });

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
      console.log('📦 Корзина не найдена, возвращаем пустую');
      res.json({ cart: { id: null, items: [], total: 0, itemsCount: 0 } });
      return;
    }

    // Парсим items и считаем сумму
    const items = Array.isArray(cart.items) ? cart.items : [];
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    console.log('📦 Корзина найдена:', { id: cart.id, itemsCount, total });

    res.json({
      cart: {
        id: cart.id,
        items: items,
        total: total,
        itemsCount: itemsCount,
      },
    });
  } catch (error) {
    console.error('❌ Get cart error:', error);
    res.status(500).json({ error: 'Ошибка получения корзины' });
  }
};

// Добавление в корзину
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    console.log('🛒 Добавление в корзину:', { productId, quantity, userId, guestId });

    // Если нет userId и guestId — создаём guestId
    if (!userId && !guestId) {
      const crypto = require('crypto');
      guestId = crypto.randomUUID();
      res.cookie('guestId', guestId, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      console.log('🆕 Создан новый guestId:', guestId);
    }

    // Получаем информацию о товаре из CRM
    const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
    const productResponse = await fetch(`${crmApiUrl}/api/public/products/${productId}`);

    if (!productResponse.ok) {
      console.error('❌ Товар не найден в CRM:', productId);
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    const product = await productResponse.json() as CRMProduct;

    console.log('📦 Информация о товаре из CRM:', {
      id: product.id,
      name: product.name,
      price: product.price,
    });

    // Ищем корзину
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

    console.log('📦 Корзина найдена:', cart ? 'да' : 'нет');

    let items: any[] = [];

    if (cart) {
      items = Array.isArray(cart.items) ? cart.items : [];
    }

    // Проверяем, есть ли уже такой товар в корзине
    const existingItemIndex = items.findIndex(
      (item) => String(item.productId) === String(productId)
    );

    if (existingItemIndex !== -1) {
      // Обновляем количество
      items[existingItemIndex].quantity += quantity;
      console.log('🔄 Обновлено количество товара:', productId, '->', items[existingItemIndex].quantity);
    } else {
      // Добавляем новый товар
      items.push({
        productId: String(productId),
        name: product.name || 'Товар',
        price: product.price || 0,
        quantity: quantity,
        image: product.images?.[0] || '/images/placeholder.jpg',
        sku: product.sku || null,
      });
      console.log('➕ Добавлен новый товар:', productId);
    }

    // Сохраняем корзину
    let updatedCart;
    if (userId) {
      updatedCart = await prisma.cart.upsert({
        where: { userId: String(userId) },
        update: { items: items },
        create: {
          userId: String(userId),
          items: items,
        },
      });
      console.log('✅ Корзина обновлена для userId:', userId);
    } else if (guestId) {
      updatedCart = await prisma.cart.upsert({
        where: { guestId: guestId },
        update: { items: items },
        create: {
          guestId: guestId,
          items: items,
        },
      });
      console.log('✅ Корзина обновлена для guestId:', guestId);
    } else {
      res.status(400).json({ error: 'Не удалось определить корзину' });
      return;
    }

    // Считаем итоги
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    console.log('✅ Корзина обновлена:', { 
      itemsCount,
      total,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
    });

    res.json({
      cart: {
        id: updatedCart.id,
        items: items,
        total: total,
        itemsCount: itemsCount,
      },
    });
  } catch (error) {
    console.error('❌ Add to cart error:', error);
    res.status(500).json({ error: 'Ошибка добавления в корзину' });
  }
};

// Обновление количества
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

    // Обновляем корзину
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

    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    res.json({
      cart: {
        id: updatedCart.id,
        items: items,
        total: total,
        itemsCount: itemsCount,
      },
    });
  } catch (error) {
    console.error('❌ Update cart error:', error);
    res.status(500).json({ error: 'Ошибка обновления корзины' });
  }
};

// Очистка корзины
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

    res.json({
      cart: {
        id: updatedCart.id,
        items: [],
        total: 0,
        itemsCount: 0,
      },
    });
  } catch (error) {
    console.error('❌ Clear cart error:', error);
    res.status(500).json({ error: 'Ошибка очистки корзины' });
  }
};