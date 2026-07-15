// backend/src/controllers/admin/orders.controller.ts (САЙТ)

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'swapservice38_internal_secret';

// ============================================================
// GET /api/admin/orders — список заказов
// ============================================================
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log('📋 GET /api/admin/orders', { page: pageNum, limit: limitNum });

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count(),
    ]);

    console.log(`✅ Найдено ${orders.length} заказов, всего ${total}`);

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
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения заказов' });
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
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    res.json({ order });
  } catch (error: any) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true, order });
  } catch (error: any) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ error: error.message });
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

    console.log(`📝 Обновление заказа ${id}`);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    if (!order.crmOrderId) {
      res.status(400).json({
        error: 'Заказ ещё не синхронизирован с CRM, редактирование недоступно',
      });
      return;
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

      console.log('📤 Отправка в CRM с Internal API Key:');
      console.log('  URL:', `${CRM_API_URL}/api/sale-documents/${order.crmOrderId}/full`);
      console.log('  Данные:', JSON.stringify(crmPayload, null, 2));

      const crmResponse = await axios.put(
        `${CRM_API_URL}/api/sale-documents/${order.crmOrderId}/full`,
        crmPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': INTERNAL_API_KEY,
          },
          timeout: 15000,
        }
      );

      console.log('✅ CRM ответ:', crmResponse.status);
    } catch (crmError: any) {
      console.error('❌ Ошибка обновления в CRM:', crmError.message);
      if (crmError.response) {
        console.error('📦 Статус:', crmError.response.status);
        console.error('📦 Ответ:', crmError.response.data);
      }
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

    console.log(`✅ Заказ ${id} обновлён`);
    res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('❌ Ошибка обновления заказа:', error.message);
    res.status(500).json({ error: error.message || 'Ошибка обновления заказа' });
  }
};

// ============================================================
// ✅ DELETE /api/admin/orders/:id — УДАЛЕНИЕ С ПРОВЕРКОЙ ПАРОЛЯ
// ============================================================
export const deleteOrderWithPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    console.log(`🗑️ Запрос на удаление заказа ${id}`);

    if (!password) {
      res.status(400).json({ error: 'Требуется ввод пароля' });
      return;
    }

    // ✅ ПОЛУЧАЕМ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ИЗ REQUEST
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // ✅ НАХОДИМ ПОЛЬЗОВАТЕЛЯ В БД
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    // ✅ ПРОВЕРЯЕМ, ЧТО ПОЛЬЗОВАТЕЛЬ — АДМИН
    if (user.role !== 'admin' && user.role !== 'manager') {
      res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin или manager' });
      return;
    }

    // ✅ ПРОВЕРЯЕМ ПАРОЛЬ
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Неверный пароль' });
      return;
    }

    // ✅ НАХОДИМ ЗАКАЗ
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    // ✅ ЛОГИРУЕМ УДАЛЕНИЕ
    console.log(`🗑️ Удаление заказа ${id} пользователем ${userId}`);

    // ✅ УДАЛЯЕМ ЗАКАЗ
    await prisma.order.delete({
      where: { id },
    });

    console.log(`✅ Заказ ${id} удалён`);

    res.json({
      success: true,
      message: 'Заказ успешно удалён',
    });
  } catch (error: any) {
    console.error('❌ Ошибка удаления заказа:', error.message);
    res.status(500).json({ error: error.message || 'Ошибка удаления заказа' });
  }
};

// ============================================================
// DELETE /api/admin/orders/:id — УДАЛЕНИЕ БЕЗ ПАРОЛЯ (СТАРЫЙ МЕТОД)
// ============================================================
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.order.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({ error: error.message });
  }
};