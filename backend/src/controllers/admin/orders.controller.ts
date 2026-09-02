// backend/src/controllers/admin/orders.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { log } from '../../config/logger';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../middleware/error.middleware';
import { addUpdateToCRMQueue, retryFailedOrders } from '../../queues/crm.queue';
import { buildCrmOrderPayload } from '../../services/crmOrderPayload.service';
import { noStartedPaymentWhere } from '../../utils/paymentSafety';
import {
  acceleratePaymentReconciliationEvent,
  crmCreateDeduplicationKey,
  dispatchPaymentRefundEvent,
  dispatchPaymentReconciliationEvent,
  ensurePaymentReconciliationEvent,
  paymentRefundDeduplicationKey,
  replayFailedPaymentRefund,
} from '../../services/crmOutbox.service';
import { lockPaymentWorkflowOrder } from '../../services/paymentWorkflowLock.service';

const prisma = new PrismaClient();
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

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
        { customerFirstName: { contains: search as string, mode: 'insensitive' } },
        { customerLastName: { contains: search as string, mode: 'insensitive' } },
        { customerPhone: { contains: search as string, mode: 'insensitive' } },
        { customerEmail: { contains: search as string, mode: 'insensitive' } },
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
        guestName: o.guestName || [o.customerLastName, o.customerFirstName, o.customerMiddleName].filter(Boolean).join(' ') || 'Гость',
        guestPhone: o.guestPhone || o.customerPhone,
        guestEmail: o.guestEmail || o.customerEmail,
        customerName: [o.customerLastName, o.customerFirstName, o.customerMiddleName].filter(Boolean).join(' ') || o.guestName || 'Гость',
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
    const order = await prisma.order.findUnique({
      where: { id },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    
    res.json({
      order: {
        ...order,
        guestName: order.guestName || [order.customerLastName, order.customerFirstName, order.customerMiddleName].filter(Boolean).join(' '),
        guestPhone: order.guestPhone || order.customerPhone,
        guestEmail: order.guestEmail || order.customerEmail,
      },
    });
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
  res.status(410).json({
    error: 'Lifecycle status управляется CRM и доступен на сайте только для чтения',
  });
};

export const retryFailedRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const replay = await replayFailedPaymentRefund(req.params.id);
    await dispatchPaymentRefundEvent(replay.outboxEvent.id).catch(() => false);
    res.json({ success: true, ...replay });
  } catch (error: any) {
    throw new AppError(error?.message || 'Refund replay failed', 409);
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
      deliveryProvider,
      contactMethod,
      comment,
      deliveryMethod,
      items,
    } = req.body;

    log.info(`📝 Обновление заказа ${id}`);

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { firstName: true, lastName: true, middleName: true, phone: true, email: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }

    if (!order.crmOrderId) {
      throw new AppError('Заказ ещё не синхронизирован с CRM, редактирование недоступно', 400);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        guestName: guestName !== undefined ? guestName : order.guestName,
        guestPhone: guestPhone !== undefined ? guestPhone : order.guestPhone,
        guestEmail: guestEmail !== undefined ? guestEmail : order.guestEmail,
        deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : order.deliveryAddress,
        deliveryProvider: deliveryProvider !== undefined ? deliveryProvider : order.deliveryProvider,
        contactMethod: contactMethod !== undefined ? contactMethod : order.contactMethod,
        comment: comment !== undefined ? comment : order.comment,
        deliveryMethod: deliveryMethod || order.deliveryMethod,
        items: items || order.items,
        updatedAt: new Date(),
      },
    });

    try {
      const completePayload = buildCrmOrderPayload({ ...updatedOrder, user: order.user });
      const crmPayload: any = {
        clientData: {
          ...completePayload.client,
        },
        description: completePayload.comment,
        deliveryMethod: completePayload.deliveryMethod,
        deliveryAddress: completePayload.deliveryAddress,
        deliveryProvider: completePayload.deliveryProvider,
        contactMethod: completePayload.contactMethod,
        items: completePayload.items,
      };

      await addUpdateToCRMQueue(updatedOrder.id, order.crmOrderId, crmPayload);
      log.info(`📤 Обновление заказа ${id} добавлено в очередь CRM`);
    } catch (crmError: any) {
      log.error('❌ Ошибка постановки обновления в очередь CRM', { error: crmError.message });
    }

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

    const deleted = await prisma.order.deleteMany({
      where: { id, ...noStartedPaymentWhere },
    });
    if (deleted.count !== 1) {
      throw new AppError('Нельзя удалить заказ после начала оплаты', 409);
    }

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
        ...noStartedPaymentWhere,
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
    res.status(500).json({ error: 'Ошибка массового удаления' });
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
        ...noStartedPaymentWhere,
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
    res.status(500).json({ error: 'Ошибка массового удаления' });
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

    const deleted = await prisma.order.deleteMany({
      where: { id, ...noStartedPaymentWhere },
    });
    if (deleted.count !== 1) {
      throw new AppError('Нельзя удалить заказ после начала оплаты', 409);
    }

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

    const reconciliation = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, id);
      const currentOrder = await tx.order.findUnique({ where: { id } });
      if (!currentOrder || currentOrder.crmOrderId) {
        throw new AppError('Заказ уже обработан или не найден', 409);
      }
      if (currentOrder.status !== 'paid' && currentOrder.status !== 'crm_failed') {
        throw new AppError('Состояние заказа изменилось', 409);
      }
      const attempt = await tx.paymentAttempt.findUnique({ where: { orderId: id } });
      if (!attempt?.providerPaymentId || !attempt.reservationId) {
        throw new AppError('Для заказа нет durable payment reservation', 409);
      }
      const refund = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: paymentRefundDeduplicationKey(attempt.providerPaymentId) },
      });
      if (refund) throw new AppError('Для заказа уже запущен durable refund workflow', 409);
      const original = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: crmCreateDeduplicationKey(id) },
      });
      const immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
      if (!immutableOrderData) throw new AppError('Immutable CRM payload не найден', 409);
      const event = await ensurePaymentReconciliationEvent(
        tx, id, attempt.providerPaymentId, immutableOrderData,
      );
      await acceleratePaymentReconciliationEvent(tx, event.id);
      return event;
    });

    // Best-effort acceleration only; PostgreSQL remains the recovery source.
    await dispatchPaymentReconciliationEvent(reconciliation.id).catch(() => false);

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
