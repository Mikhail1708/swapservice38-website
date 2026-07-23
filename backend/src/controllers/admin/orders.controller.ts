// backend/src/controllers/admin/orders.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { log } from '../../config/logger';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../middleware/error.middleware';
import { addOrderToCRMQueue, retryFailedOrders } from '../../queues/crm.queue';

const prisma = new PrismaClient();
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'swapservice38_internal_secret';

// ============================================================
// GET /api/admin/orders — список заказов
// ============================================================
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { guestName: { contains: search as string, mode: 'insensitive' } },
        { guestPhone: { contains: search as string, mode: 'insensitive' } },
        { guestEmail: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status as string;
    }

    log.debug('📋 GET /api/admin/orders', { page: pageNum, limit: limitNum, search, status });

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    log.debug(`✅ Найдено ${orders.length} заказов, всего ${total}`);

    res.json({
      orders: orders.map((o: any) => ({
        ...o,
        customerName: o.guestName || 'Гость',
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    log.error('❌ Get orders error', { error: error.message });
    throw new AppError('Ошибка получения заказов', 500);
  }
};

// ============================================================
// GET /api/admin/orders/:id — получить заказ
// ============================================================
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    
    res.json({ order });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Get order error', { error: error.message });
    throw new AppError('Ошибка получения заказа', 500);
  }
};

// ============================================================
// PATCH /api/admin/orders/:id/status — обновить статус
// ============================================================
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });
    
    log.info(`📝 Статус заказа ${id} обновлён на ${status}`);
    res.json({ success: true, order });
  } catch (error: any) {
    log.error('❌ Update order status error', { error: error.message });
    throw new AppError('Ошибка обновления статуса', 500);
  }
};

// ============================================================
// PUT /api/admin/orders/:id — ПОЛНОЕ ОБНОВЛЕНИЕ ЗАКАЗА
// ============================================================
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      guestName,
      guestPhone,
      guestEmail,
      deliveryAddress,
      comment,
      deliveryMethod,
      items,
    } = req.body;

    log.info(`📝 Обновление заказа ${id}`);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }

    if (!order.crmOrderId) {
      throw new AppError('Заказ ещё не синхронизирован с CRM, редактирование недоступно', 400);
    }

    try {
      const crmPayload: any = {
        clientData: {
          name: guestName !== undefined ? guestName : order.guestName || '',
          phone: guestPhone !== undefined ? guestPhone : order.guestPhone || '',
          email: guestEmail !== undefined ? guestEmail : order.guestEmail || '',
          address: deliveryAddress !== undefined ? deliveryAddress : order.deliveryAddress || '',
        },
        description: comment !== undefined ? comment : order.comment || '',
        deliveryMethod: deliveryMethod || order.deliveryMethod || 'courier',
        items: items || order.items,
      };

      await addOrderToCRMQueue(order.id, crmPayload);
      log.info(`📤 Обновление заказа ${id} добавлено в очередь CRM`);
    } catch (crmError: any) {
      log.error('❌ Ошибка обновления в CRM', { error: crmError.message });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        guestName: guestName !== undefined ? guestName : order.guestName,
        guestPhone: guestPhone !== undefined ? guestPhone : order.guestPhone,
        guestEmail: guestEmail !== undefined ? guestEmail : order.guestEmail,
        deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : order.deliveryAddress,
        comment: comment !== undefined ? comment : order.comment,
        deliveryMethod: deliveryMethod || order.deliveryMethod,
        items: items || order.items,
        updatedAt: new Date(),
      },
    });

    log.info(`✅ Заказ ${id} обновлён`);
    res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Ошибка обновления заказа', { error: error.message });
    throw new AppError('Ошибка обновления заказа', 500);
  }
};

// ============================================================
// ✅ DELETE /api/admin/orders/:id — УДАЛЕНИЕ
// ============================================================
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    log.info(`🗑️ Удаление заказа ${id}`);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }

    // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
    const user = (req as any).user;
    let allowedStatuses: string[];
    
    if (user?.role === 'admin') {
      allowedStatuses = ['pending', 'crm_failed', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled'];
    } else {
      allowedStatuses = ['pending', 'crm_failed'];
    }

    if (!allowedStatuses.includes(order.status)) {
      throw new AppError(`Нельзя удалить заказ в статусе ${order.status}`, 400);
    }

    await prisma.order.delete({
      where: { id },
    });

    log.info(`🗑️ Заказ ${id} удалён`);
    res.json({ success: true, message: 'Заказ удалён' });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Delete order error', { error: error.message });
    throw new AppError('Ошибка удаления заказа', 500);
  }
};

// ============================================================
// ✅ POST /api/admin/orders/mass-delete — МАССОВОЕ УДАЛЕНИЕ
// ============================================================
export const massDeleteOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Не указаны ID заказов' });
      return;
    }
    
    log.info(`🗑️ Массовое удаление заказов: ${ids.length} шт.`);
    
    // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
    const user = (req as any).user;
    let allowedStatuses: string[];
    
    if (user?.role === 'admin') {
      allowedStatuses = ['pending', 'crm_failed', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled'];
    } else {
      allowedStatuses = ['pending', 'crm_failed'];
    }
    
    const result = await prisma.order.deleteMany({
      where: {
        id: { in: ids },
        status: {
          in: allowedStatuses,
        },
      },
    });
    
    log.info(`🗑️ Удалено ${result.count} заказов`);
    res.json({ 
      success: true, 
      deleted: result.count,
      message: `Удалено ${result.count} заказов` 
    });
  } catch (error: any) {
    log.error('❌ Mass delete orders error', { error: error.message });
    res.status(500).json({ error: error.message || 'Ошибка массового удаления' });
  }
};

// ============================================================
// ✅ POST /api/admin/orders/mass-delete-with-password — МАССОВОЕ УДАЛЕНИЕ С ПАРОЛЕМ
// ============================================================
export const massDeleteOrdersWithPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, password } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Не указаны ID заказов' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Требуется ввод пароля' });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new UnauthorizedError('Не авторизован');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('Пользователь не найден');
    }

    // ✅ ПРОВЕРЯЕМ ПАРОЛЬ
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isPasswordValid) {
      throw new AppError('Неверный пароль', 401);
    }

    // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
    let allowedStatuses: string[];
    if (user.role === 'admin') {
      allowedStatuses = ['pending', 'crm_failed', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled'];
    } else {
      allowedStatuses = ['pending', 'crm_failed'];
    }
    
    log.info(`🗑️ Массовое удаление заказов с паролем: ${ids.length} шт. (роль: ${user.role})`);
    
    const result = await prisma.order.deleteMany({
      where: {
        id: { in: ids },
        status: {
          in: allowedStatuses,
        },
      },
    });
    
    log.info(`🗑️ Удалено ${result.count} заказов пользователем ${userId}`);
    res.json({ 
      success: true, 
      deleted: result.count,
      message: `Удалено ${result.count} заказов` 
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Mass delete orders with password error', { error: error.message });
    res.status(500).json({ error: error.message || 'Ошибка массового удаления' });
  }
};

// ============================================================
// DELETE /api/admin/orders/:id — УДАЛЕНИЕ С ПАРОЛЕМ
// ============================================================
export const deleteOrderWithPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    log.info(`🗑️ Запрос на удаление заказа ${id} с паролем`);

    if (!password) {
      throw new AppError('Требуется ввод пароля', 400);
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new UnauthorizedError('Не авторизован');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('Пользователь не найден');
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new ForbiddenError('Доступ запрещён. Требуется роль admin или manager');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isPasswordValid) {
      throw new AppError('Неверный пароль', 401);
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }

    // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
    let allowedStatuses: string[];
    if (user.role === 'admin') {
      allowedStatuses = ['pending', 'crm_failed', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled'];
    } else {
      allowedStatuses = ['pending', 'crm_failed'];
    }

    if (!allowedStatuses.includes(order.status)) {
      throw new AppError(`Нельзя удалить заказ в статусе ${order.status}`, 400);
    }

    await prisma.order.delete({
      where: { id },
    });

    log.info(`🗑️ Заказ ${id} удалён пользователем ${userId}`);
    res.json({
      success: true,
      message: 'Заказ успешно удалён',
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Ошибка удаления заказа', { error: error.message });
    throw new AppError('Ошибка удаления заказа', 500);
  }
};

// ============================================================
// POST /api/admin/orders/:id/retry — ПОВТОРНАЯ ОТПРАВКА В CRM
// ============================================================
export const retryOrderToCRM = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    log.info(`🔄 Повторная отправка заказа ${id} в CRM`);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }

    if (order.crmOrderId) {
      throw new AppError('Заказ уже отправлен в CRM', 400);
    }

    if (order.status !== 'paid' && order.status !== 'crm_failed') {
      throw new AppError(`Заказ в статусе ${order.status} нельзя отправить в CRM`, 400);
    }

    const phone = order.guestPhone || '';
    const orderData = {
      items: (order.items as any[]).map((item: any) => ({
        productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
        quantity: item.quantity || 1,
        price: item.price || 0,
      })),
      client: {
        firstName: order.guestName || 'Клиент',
        lastName: '',
        phone: phone || '+79999999999',
        email: order.guestEmail || '',
        city: '',
        address: order.deliveryAddress || '',
      },
      deliveryMethod: order.deliveryMethod || 'pickup',
      deliveryAddress: order.deliveryAddress || '',
      comment: order.comment || '',
      source: 'website_retry'
    };

    await addOrderToCRMQueue(id, orderData);

    await prisma.order.update({
      where: { id },
      data: {
        status: 'paid',
        comment: 'Повторная отправка в CRM через очередь',
      },
    });

    log.info(`✅ Заказ ${id} добавлен в очередь для повторной отправки`);
    res.json({
      success: true,
      message: 'Заказ добавлен в очередь для повторной отправки',
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    log.error('❌ Ошибка повторной отправки заказа', { error: error.message });
    throw new AppError('Ошибка повторной отправки заказа', 500);
  }
};