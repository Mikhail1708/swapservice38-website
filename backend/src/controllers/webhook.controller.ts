// backend/src/controllers/webhook.controller.ts (САЙТ) — НЕ МЕНЯЕТСЯ

import { Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Маппинг статусов из CRM в статусы сайта
const statusMap: Record<string, string> = {
  'ordered': 'pending',
  'assembling': 'assembling',
  'shipped': 'shipped',
  'delivered': 'delivered',
  'cancelled': 'cancelled',
  'paid': 'paid',
  'confirmed': 'confirmed',
};

/**
 * Каноническая сериализация — сортировка ключей по алфавиту
 */
const canonicalStringify = (obj: Record<string, any>): string => {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return JSON.stringify(sortedObj);
};

/**
 * POST /api/webhooks/crm/order-status
 */
export const handleOrderStatusWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const payload = req.body;

    console.log('📥 Получен вебхук:');
    console.log('  Signature:', signature);
    console.log('  Payload:', JSON.stringify(payload, null, 2));

    if (!signature) {
      console.error('❌ Webhook: Отсутствует подпись');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    if (!WEBHOOK_SECRET) {
      console.warn('⚠️ WEBHOOK_SECRET не настроен, проверка подписи пропущена');
    } else {
      const payloadString = canonicalStringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payloadString)
        .digest('hex');

      console.log('  Expected signature:', expectedSignature);
      console.log('  Received signature:', signature);
      console.log('  Match:', signature === expectedSignature);

      if (signature !== expectedSignature) {
        console.error('❌ Webhook: Неверная подпись');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const { crmOrderId, status, documentNumber } = payload;

    if (!crmOrderId || !status) {
      console.error('❌ Webhook: Отсутствуют обязательные поля');
      res.status(400).json({ error: 'Missing crmOrderId or status' });
      return;
    }

    console.log(`📥 Получен вебхук: заказ ${documentNumber || crmOrderId} → статус "${status}"`);

    const siteStatus = statusMap[status] || status;
    console.log(`🔄 Маппинг статуса: ${status} → ${siteStatus}`);

    // ✅ ИЩЕМ ЗАКАЗ ПО crmOrderId
    const order = await prisma.order.findFirst({
      where: {
        crmOrderId: String(crmOrderId),
      },
    });

    if (!order) {
      console.warn(`⚠️ Webhook: Заказ с crmOrderId=${crmOrderId} не найден в БД сайта`);
      res.status(200).json({
        success: false,
        message: `Order with crmOrderId ${crmOrderId} not found`,
      });
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: siteStatus,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Webhook: Заказ ${order.id} (crmOrderId: ${crmOrderId}) обновлён → статус "${siteStatus}"`);
    res.status(200).json({
      success: true,
      message: `Order ${order.id} status updated to ${siteStatus}`,
    });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/webhooks/crm/health
 */
export const webhookHealthCheck = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'crm-webhook-receiver',
    webhookSecret: process.env.WEBHOOK_SECRET ? '✅ set' : '❌ missing',
    env: process.env.NODE_ENV || 'development',
  });
};