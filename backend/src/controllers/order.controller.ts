// backend/src/controllers/order.controller.ts (САЙТ)
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { clearCart } from '../services/cart.service';

const prisma = new PrismaClient();

// ============================================================
// ПОЛУЧЕНИЕ КОРЗИНЫ С ПОДСЧЁТОМ
// ============================================================
const getCartWithTotal = async (userId?: string) => {
  console.log('🔍 getCartWithTotal:', { userId });
  
  if (!userId) {
    console.log('ℹ️ Нет userId, возвращаем пустую корзину');
    return { id: null, items: [], total: 0, itemsCount: 0 };
  }
  
  const cart = await prisma.cart.findUnique({
    where: { userId: String(userId) },
  });

  console.log('📦 Корзина найдена для userId:', cart ? 'да (id: ' + cart.id + ')' : 'нет');

  if (!cart) {
    return { id: null, items: [], total: 0, itemsCount: 0 };
  }

  const items = Array.isArray(cart.items) ? cart.items : [];
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  console.log('🛒 Товаров в корзине (БД):', items.length);

  return {
    id: cart.id,
    items: items,
    total: total,
    itemsCount: itemsCount,
  };
};

// ============================================================
// ПЕРЕНОС КОРЗИНЫ С guestId НА userId
// ============================================================
const mergeCart = async (userId: string, guestId: string | undefined) => {
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
// POST /api/orders — СОЗДАНИЕ ЗАКАЗА (ТОЛЬКО АВТОРИЗОВАННЫЕ)
// ============================================================
export const createOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ ТОЛЬКО АВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ
    const userId = (req as any).user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;
    
    if (!userId) {
      console.log('❌ Пользователь не авторизован');
      res.status(401).json({ error: 'Необходимо авторизоваться' });
      return;
    }

    console.log('📝 Создание заказа для пользователя:', userId);
    console.log('  guestId из запроса:', guestId);

    // ✅ ЕСЛИ ЕСТЬ guestId — ПЕРЕНЕСИ КОРЗИНУ
    if (guestId) {
      await mergeCart(userId, guestId);
      // Удаляем guestId cookie
      res.clearCookie('guestId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    const {
      deliveryMethod,
      deliveryAddress,
      comment,
      client,
    } = req.body;

    if (!client) {
      res.status(400).json({ error: 'Данные клиента обязательны' });
      return;
    }

    if (!client.phone) {
      res.status(400).json({ error: 'Телефон клиента обязателен' });
      return;
    }

    // ===== ПОЛУЧАЕМ КОРЗИНУ =====
    const cart = await getCartWithTotal(userId);
    
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      console.error('❌ Корзина пуста');
      res.status(400).json({ error: 'Корзина пуста' });
      return;
    }

    console.log('🛒 Корзина:', cart.items.length, 'товаров');

    // ===== СОЗДАЁМ ЗАКАЗ СО СТАТУСОМ PENDING =====
    const total = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    const localOrder = await prisma.order.create({
      data: {
        userId: userId,
        guestEmail: client.email || null,
        guestPhone: client.phone || null,
        guestName: client.firstName || null,
        items: cart.items,
        total,
        status: 'pending',
        deliveryMethod: deliveryMethod || 'pickup',
        deliveryAddress: deliveryAddress || null,
        comment: comment || null,
      }
    });

    console.log('✅ Локальный заказ создан (pending):', localOrder.id);

    res.status(201).json({
      success: true,
      order: {
        id: localOrder.id,
        total: localOrder.total,
        status: localOrder.status,
      },
      message: 'Заказ создан, ожидает оплаты'
    });

  } catch (error: any) {
    console.error('❌ Ошибка создания заказа:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка создания заказа' 
    });
  }
};

// ============================================================
// GET /api/orders/:id — ПОЛУЧЕНИЕ ЗАКАЗА (ТОЛЬКО СВОЙ)
// ============================================================
export const getOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    console.log(`📦 Запрос заказа ${id} для пользователя ${userId}`);

    const order = await prisma.order.findFirst({
      where: {
        id: id,
        userId: userId,
      }
    });

    if (!order) {
      console.log(`❌ Заказ ${id} не найден для пользователя ${userId}`);
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    console.log(`✅ Заказ ${id} найден`);
    res.json({ order });
  } catch (error: any) {
    console.error('❌ Ошибка получения заказа:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения заказа' });
  }
};

// ============================================================
// GET /api/orders — ВСЕ ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const getUserOrdersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    console.log(`📋 Получение заказов пользователя ${userId}`);

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ Найдено ${orders.length} заказов`);
    res.json({ orders });
  } catch (error: any) {
    console.error('❌ Ошибка получения заказов:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения заказов' });
  }
};