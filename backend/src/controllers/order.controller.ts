// frontend/backend/src/controllers/order.controller.ts (САЙТ)
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ ДОБАВЛЯЕМ ТИП ДЛЯ ЭЛЕМЕНТА КОРЗИНЫ
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string | null;
  maxStock?: number;
}

// ============================================================
// БЕЗОПАСНОЕ ПРИВЕДЕНИЕ ЭЛЕМЕНТОВ КОРЗИНЫ
// ============================================================
const safeItems = (items: any): CartItem[] => {
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.filter((item: any) => 
      item && typeof item === 'object' && 
      'productId' in item && 
      'quantity' in item &&
      'price' in item
    ) as CartItem[];
  }
  return [];
};

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

  // ✅ ИСПОЛЬЗУЕМ БЕЗОПАСНОЕ ПРИВЕДЕНИЕ
  const items = safeItems(cart.items);
  const total = items.reduce((sum: number, item: CartItem) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const itemsCount = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);

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

    const guestCart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!guestCart || !guestCart.items || (guestCart.items as any[]).length === 0) {
      console.log('ℹ️ Корзина гостя пуста');
      return;
    }

    const guestItems = safeItems(guestCart.items);
    console.log(`📦 Товаров в гостевой корзине: ${guestItems.length}`);

    let userCart = await prisma.cart.findUnique({
      where: { userId: userId },
    });

    if (userCart) {
      const userItems = safeItems(userCart.items);
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
        data: { items: mergedItems as any },
      });
      console.log(`✅ Корзина пользователя обновлена, ${mergedItems.length} товаров`);
    } else {
      await prisma.cart.create({
        data: {
          userId: userId,
          items: guestItems as any,
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
// POST /api/orders — СОЗДАНИЕ ЗАКАЗА
// ============================================================
export const createOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;
    
    if (!userId) {
      console.log('❌ Пользователь не авторизован');
      res.status(401).json({ error: 'Необходимо авторизоваться' });
      return;
    }

    console.log('📝 Создание заказа для пользователя:', userId);
    console.log('  guestId из запроса:', guestId);

    if (guestId) {
      await mergeCart(userId, guestId);
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

    const cart = await getCartWithTotal(userId);
    
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      console.error('❌ Корзина пуста');
      res.status(400).json({ error: 'Корзина пуста' });
      return;
    }

    console.log('🛒 Корзина:', cart.items.length, 'товаров');

    // ✅ total УЖЕ ПОСЧИТАН В getCartWithTotal, НО ПЕРЕСЧИТЫВАЕМ ДЛЯ НАДЕЖНОСТИ
    const total = cart.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
    
    // ✅ СОЗДАЁМ ЗАКАЗ ТОЛЬКО ЛОКАЛЬНО
    const localOrder = await prisma.order.create({
      data: {
        userId: userId,
        guestEmail: client.email || null,
        guestPhone: client.phone || null,
        guestName: client.firstName || null,
        items: cart.items as any,
        total: total,
        status: 'pending',
        deliveryMethod: deliveryMethod || 'pickup',
        deliveryAddress: deliveryAddress || null,
        comment: comment || null,
      }
    });

    console.log('✅ Локальный заказ создан (pending):', localOrder.id);

    // ✅ ОЧИЩАЕМ КОРЗИНУ
    if (cart.id) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { items: [] },
      });
      console.log('🧹 Корзина очищена');
    }

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
// GET /api/orders/:id — ПОЛУЧЕНИЕ ЗАКАЗА
// ============================================================
export const getOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    console.log(`📦 Запрос заказа ${id} для пользователя ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

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

// ============================================================
// DELETE /api/orders/:id — УДАЛЕНИЕ ЗАКАЗА
// ============================================================
export const deleteOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    console.log(`🗑️ Удаление заказа ${id} для пользователя ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

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

    // ❌ НЕЛЬЗЯ УДАЛИТЬ, ЕСЛИ УЖЕ ОТПРАВЛЕН В CRM
    if (order.crmOrderId) {
      console.log(`❌ Заказ ${id} уже отправлен в CRM (crmOrderId: ${order.crmOrderId})`);
      res.status(400).json({ 
        error: 'Нельзя удалить заказ, который уже обработан' 
      });
      return;
    }

    // Только pending можно удалить
    if (order.status !== 'pending') {
      console.log(`❌ Заказ ${id} в статусе ${order.status} — нельзя удалить`);
      res.status(400).json({ 
        error: 'Нельзя удалить заказ в статусе ' + order.status 
      });
      return;
    }

    // Проверяем 12-часовой лимит
    const createdAt = new Date(order.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 12) {
      console.log(`❌ Заказ ${id} создан ${hoursDiff.toFixed(1)} часов назад — лимит истёк`);
      res.status(400).json({ 
        error: 'Время на удаление заказа истекло (12 часов)' 
      });
      return;
    }

    await prisma.order.delete({
      where: { id: id },
    });

    console.log(`✅ Заказ ${id} удалён`);
    res.json({ 
      success: true, 
      message: 'Заказ успешно удалён' 
    });

  } catch (error: any) {
    console.error('❌ Ошибка удаления заказа:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка удаления заказа' 
    });
  }
};