import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Создание заказа из корзины
export const createOrder = async (
  userId: string | undefined,
  guestId: string | undefined,
  orderData: {
    deliveryMethod: string;
    deliveryAddress?: string;
    comment?: string;
    guestEmail?: string;
    guestPhone?: string;
    guestName?: string;
  }
) => {
  // Получаем корзину
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId } : { guestId },
  });

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new Error('Корзина пуста');
  }

  const items = cart.items as any[];
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Создаём заказ
  const order = await prisma.order.create({
    data: {
      userId: userId || null,
      guestEmail: orderData.guestEmail,
      guestPhone: orderData.guestPhone,
      guestName: orderData.guestName,
      items: cart.items,
      total,
      status: 'pending',
      deliveryMethod: orderData.deliveryMethod,
      deliveryAddress: orderData.deliveryAddress,
      comment: orderData.comment,
    },
  });

  // Очищаем корзину после создания заказа
  await prisma.cart.update({
    where: { id: cart.id },
    data: { items: [] },
  });

  return order;
};

// Получение заказа по ID
export const getOrderById = async (orderId: string, userId?: string) => {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      ...(userId ? { userId } : {}),
    },
  });
};

// Обновление статуса заказа
export const updateOrderStatus = async (orderId: string, status: string, crmOrderId?: string) => {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      crmOrderId,
    },
  });
};