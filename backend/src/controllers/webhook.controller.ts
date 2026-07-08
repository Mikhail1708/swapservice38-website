// backend/src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks/crm/order-status
 * Приём вебхука от CRM при изменении статуса заказа
 */
export const handleOrderStatusWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const payload = req.body;

    // 1. Проверка наличия подписи
    if (!signature) {
      console.error('❌ Webhook: Отсутствует подпись');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    // 2. Проверка подписи
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Webhook: Неверная подпись');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // 3. Извлечение данных
    const { crmOrderId, status, documentNumber, timestamp } = payload;

    if (!crmOrderId || !status) {
      console.error('❌ Webhook: Отсутствуют обязательные поля');
      res.status(400).json({ error: 'Missing crmOrderId or status' });
      return;
    }

    console.log(`📥 Получен вебхук: заказ ${documentNumber || crmOrderId} → статус "${status}"`);

    // 4. Обновление заказа в БД сайта
    // Ищем заказ по crmOrderId (хранится как строка)
    const updatedOrder = await prisma.order.updateMany({
      where: {
        crmOrderId: String(crmOrderId),
      },
      data: {
        status: status,
        updatedAt: new Date(),
      },
    });

    if (updatedOrder.count === 0) {
      console.warn(`⚠️ Webhook: Заказ с crmOrderId=${crmOrderId} не найден в БД сайта`);
      // Всё равно возвращаем 200, чтобы CRM не повторяла вебхук
      res.status(200).json({
        success: false,
        message: `Order with crmOrderId ${crmOrderId} not found`,
      });
      return;
    }

    console.log(`✅ Webhook: Заказ ${crmOrderId} обновлён → статус "${status}"`);
    res.status(200).json({
      success: true,
      message: `Order ${crmOrderId} status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/webhooks/crm/health
 * Проверка доступности эндпоинта вебхуков
 */
export const webhookHealthCheck = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'crm-webhook-receiver',
  });
};