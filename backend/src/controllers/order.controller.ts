import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getCart, clearCart, getCartWithTotal } from '../services/cart.service';
import { createOrderInCRM } from '../services/crm.service';

const prisma = new PrismaClient();

// Создание локального заказа (для истории на сайте)
const createLocalOrder = async (
  userId: string | undefined,
  guestId: string | undefined,
  cartItems: any[],
  orderData: any
) => {
  const total = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  
  return prisma.order.create({
    data: {
      userId: userId || null,
      guestEmail: orderData.client.email || null,
      guestPhone: orderData.client.phone || null,
      guestName: orderData.client.firstName || null,
      items: cartItems,
      total,
      status: 'paid',
      deliveryMethod: orderData.deliveryMethod,
      deliveryAddress: orderData.deliveryAddress || null,
      comment: orderData.comment || null,
    }
  });
};

/**
 * POST /api/orders
 * Создание заказа с отправкой в CRM
 */
export const createOrderController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const guestId = req.cookies?.guestId; // 👈 Получаем из cookies
    
    console.log('📝 Creating order...');
    console.log('  userId:', userId);
    console.log('  guestId:', guestId);
    console.log('  body:', req.body);

    // Если нет guestId и нет userId - ошибка
    if (!userId && !guestId) {
      return res.status(400).json({ error: 'Необходим userId или guestId' });
    }

    const {
      deliveryMethod,
      deliveryAddress,
      comment,
      guestEmail,
      guestPhone,
      guestName,
      city
    } = req.body;

    // 1. Получаем корзину (используем существующую функцию getCartWithTotal)
    const cart = await getCartWithTotal(userId, guestId);
    
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }

    console.log('🛒 Cart found:', cart.items.length, 'items');

    // 2. Формируем данные для CRM
    const orderData = {
      items: cart.items.map((item: any) => ({
        productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
        quantity: item.quantity,
        price: item.price
      })),
      client: {
        firstName: guestName || 'Гость',
        lastName: '',
        phone: guestPhone || '',
        email: guestEmail || '',
        city: city || '',
        address: deliveryAddress || ''
      },
      deliveryMethod: deliveryMethod || 'pickup',
      deliveryAddress: deliveryAddress || '',
      comment: comment || '',
      source: 'website'
    };

    console.log('📤 Sending to CRM:', JSON.stringify(orderData, null, 2));

    // 3. Создаём заказ в CRM
    const crmResult = await createOrderInCRM(orderData);

    // 4. Сохраняем локальный заказ (для истории на сайте)
    const localOrder = await createLocalOrder(
      userId, 
      guestId, 
      cart.items, 
      { ...orderData, client: { ...orderData.client, email: guestEmail } }
    );

    // 5. Очищаем корзину
    await clearCart(cart.id);

    // 6. Возвращаем результат
    res.status(201).json({
      success: true,
      order: {
        id: localOrder.id,
        crmOrderId: crmResult.orderId,
        documentNumber: crmResult.documentNumber,
        total: crmResult.total,
        status: 'paid'
      },
      message: 'Заказ успешно создан'
    });

  } catch (error: any) {
    console.error('❌ Order creation error:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка создания заказа' 
    });
  }
};

/**
 * GET /api/orders/:id
 * Получение заказа
 */
export const getOrderController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const order = await prisma.order.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {})
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ order });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * GET /api/orders/status/:crmOrderId
 * Получение статуса заказа из CRM
 */
export const getOrderStatusFromCRMController = async (req: Request, res: Response) => {
  try {
    const { crmOrderId } = req.params;
    const userId = (req as any).user?.id;

    // Проверяем, что заказ принадлежит пользователю
    const localOrder = await prisma.order.findFirst({
      where: {
        crmOrderId,
        ...(userId ? { userId } : {})
      }
    });

    if (!localOrder) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    // Получаем статус из CRM
    const status = await getOrderStatusFromCRM(parseInt(crmOrderId));
    
    res.json({ 
      orderId: localOrder.id,
      crmOrderId,
      status: status.orderStatus || 'ordered'
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};