// frontend/backend/src/controllers/order.controller.ts (САЙТ, порт 5001)
import { Request, Response } from 'express';
import { ensurePersonalDataConsent, offerEvidence } from '../services/consent.service';
import { AppError } from '../middleware/error.middleware';
import { PrismaClient } from '@prisma/client';
import {
  sendOrderCreatedToCustomer,
  sendOrderNotificationToManager,
} from '../services/email.service';
import {
  CheckoutInventoryError,
  validateCheckoutItems,
} from '../services/checkoutInventory.service';
import {
  OrderCancellationError,
  requestOrderCancellation,
} from '../services/orderCancellation.service';
import { log } from '../config/logger';

const prisma = new PrismaClient();

const isSerializableConflict = (error: unknown): boolean => (
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'
);

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string | null;
  maxStock?: number;
}

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

const getCartWithTotal = async (userId?: string) => {

  if (!userId) {
    console.log('ℹ️ Нет userId, возвращаем пустую корзину');
    return { id: null, items: [], total: 0, itemsCount: 0 };
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: String(userId) },
  });


  if (!cart) {
    return { id: null, items: [], total: 0, itemsCount: 0 };
  }

  const items = safeItems(cart.items);
  const total = items.reduce((sum: number, item: CartItem) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const itemsCount = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);


  return {
    id: cart.id,
    items: items,
    total: total,
    itemsCount: itemsCount,
  };
};

const mergeCart = async (userId: string, guestId: string | undefined) => {
  if (!guestId) {
    return;
  }

  try {

    const guestCart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });

    if (!guestCart || !guestCart.items || (guestCart.items as any[]).length === 0) {
      return;
    }

    const guestItems = safeItems(guestCart.items);

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
        } else {
          mergedItems.push(guestItem);
        }
      }

      await prisma.cart.update({
        where: { userId: userId },
        data: { items: mergedItems as any },
      });
    } else {
      await prisma.cart.create({
        data: {
          userId: userId,
          items: guestItems as any,
        },
      });
    }

    await prisma.cart.delete({
      where: { guestId: guestId },
    });

  } catch (error) {
    log.error('Cart merge failed', { error: error instanceof Error ? error.message : 'unknown' });
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
      res.status(401).json({ error: 'Необходимо авторизоваться' });
      return;
    }


    const offer = offerEvidence(req.body.offerAcceptance);
    await ensurePersonalDataConsent(prisma, userId, req.body.personalDataConsent, false);

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
      client,
      deliveryMethod,
      deliveryAddress,
      deliveryProvider,
      contactMethod,
      comment,
    } = req.body;

    const allowedContactMethods = new Set(['phone', 'whatsapp', 'telegram', 'email']);
    const normalizedContactMethod = allowedContactMethods.has(contactMethod) ? contactMethod : 'phone';
    if (!client?.firstName || !client?.lastName || !client?.phone || !client?.email) {
      res.status(400).json({ error: 'Укажите имя, фамилию, телефон и email покупателя' });
      return;
    }

    const cart = await getCartWithTotal(userId);

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      res.status(400).json({ error: 'Корзина пуста' });
      return;
    }

    const validatedCart = await validateCheckoutItems(cart.items);

    // Создание заказа и очистка корзины атомарны. Serializable не позволяет
    // двум параллельным checkout-запросам создать заказы из одного snapshot.
    let localOrder: any;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        localOrder = await prisma.$transaction(async (tx) => {
          const currentCart = await tx.cart.findUnique({ where: { id: cart.id } });
          const currentItems = safeItems(currentCart?.items);
          if (!currentCart || JSON.stringify(currentItems) !== JSON.stringify(cart.items)) {
            throw new CheckoutInventoryError(
              'Корзина изменилась во время оформления. Повторите попытку',
              409,
              'CART_CHANGED',
            );
          }

          const consent = await ensurePersonalDataConsent(tx, userId, req.body.personalDataConsent, true);
          const order = await tx.order.create({
            data: {
              userId: userId,
              ...offer,
              personalDataConsentId: consent!.id,
              customerFirstName: String(client.firstName).trim(),
              customerLastName: String(client.lastName).trim(),
              customerMiddleName: client.middleName ? String(client.middleName).trim() : null,
              customerPhone: String(client.phone).trim(),
              customerEmail: String(client.email).trim().toLowerCase(),
              contactMethod: normalizedContactMethod,
              items: validatedCart.items as any,
              total: validatedCart.total,
              status: 'pending',
              deliveryMethod: deliveryMethod || 'pickup',
              deliveryAddress: deliveryAddress || null,
              deliveryProvider: deliveryMethod === 'post' ? (deliveryProvider || null) : null,
              comment: comment || null,
            },
          });

          await tx.cart.update({
            where: { id: cart.id },
            data: { items: [] },
          });
          const customerName = [
            order.customerFirstName,
            order.customerMiddleName,
            order.customerLastName,
          ].filter(Boolean).join(' ') || 'Клиент';
          const emailItems = validatedCart.items.map((item: CartItem) => ({
            name: item.name || 'Товар',
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          }));

          await Promise.all([
            sendOrderCreatedToCustomer({
              orderId: order.id,
              customerName,
              customerEmail: order.customerEmail || '',
              total: order.total,
              documentNumber: order.orderNumber || order.id,
              createdAt: order.createdAt,
              items: emailItems,
              deliveryMethod: order.deliveryMethod,
              deliveryAddress: order.deliveryAddress || '',
              deliveryProvider: order.deliveryProvider || '',
              offerVersion: order.offerVersion,
            }, tx),
            sendOrderNotificationToManager({
              orderId: order.id,
              documentNumber: order.id.slice(0, 8),
              customerName,
              customerEmail: order.customerEmail || '',
              customerPhone: order.customerPhone || '',
              total: order.total,
              items: emailItems,
              deliveryAddress: order.deliveryAddress || '',
              comment: order.comment || '',
            }, tx),
          ]);
          return order;
        }, { isolationLevel: 'Serializable' });
        break;
      } catch (error) {
        if (!isSerializableConflict(error)) throw error;
        if (attempt === 2) {
          throw new CheckoutInventoryError(
            'Корзина уже оформляется другим запросом. Повторите попытку',
            409,
            'CHECKOUT_CONFLICT',
          );
        }
      }
    }


    res.status(201).json({
      success: true,
      order: {
        id: localOrder.id,
        total: localOrder.total,
        status: localOrder.status,
      },
      message: 'Заказ создан, ожидает обработки'
    });

  } catch (error: any) {
    log.error('Order creation failed', { error: error instanceof Error ? error.message : 'unknown' });
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ code: error.code, error: error.message });
      return;
    }
    if (error instanceof CheckoutInventoryError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.details || {}),
      });
      return;
    }

    res.status(500).json({ code: 'ORDER_CREATE_FAILED', error: 'Не удалось создать заказ. Попробуйте ещё раз позже' });
  }
};

// ============================================================
// GET /api/orders/:id — ПОЛУЧЕНИЕ ЗАКАЗА
// ============================================================
export const getOrderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const order = await prisma.order.findFirst({
      where: {
        id: id,
        userId: userId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
            email: true,
            phone: true,
          }
        },
        paymentAttempts: {
          select: {
            status: true,
            refundReason: true,
            refundRequestedAt: true,
            refundedAt: true,
          },
          take: 1,
        },
      }
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    res.json({ order });
  } catch (error: any) {
    log.error('Order lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ code: 'ORDER_LOAD_FAILED', error: 'Не удалось загрузить заказ' });
  }
};

// ============================================================
// GET /api/orders — ВСЕ ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const getUserOrdersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
          }
        },
        paymentAttempts: {
          select: {
            status: true,
            refundReason: true,
            refundRequestedAt: true,
            refundedAt: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ orders });
  } catch (error: any) {
    log.error('Order list failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ code: 'ORDER_LOAD_FAILED', error: 'Не удалось загрузить заказы' });
  }
};

// ============================================================
// DELETE /api/orders/:id — legacy physical delete is retired
// ============================================================
export const deleteOrderController = async (req: Request, res: Response): Promise<void> => {
  res.status(405).json({
    error: 'Физическое удаление заказа недоступно. Используйте запрос отмены.',
    cancellationEndpoint: `/api/orders/${req.params.id}/cancellation`,
  });
};

export const requestOrderCancellationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Необходимо авторизоваться' });
      return;
    }
    const order = await requestOrderCancellation(req.params.id, userId, req.body?.reason);
    res.status(order?.cancellationState === 'requested' ? 202 : 200).json({ success: true, order });
  } catch (error: any) {
    if (error instanceof OrderCancellationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    log.error('Order cancellation request failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Не удалось запросить отмену заказа' });
  }
};
