// backend/src/controllers/webhook.controller.ts (САЙТ)
import { Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  assertOrderStatusTransition,
  InvalidOrderStatusTransitionError,
  shouldApplyCrmStatusVersion,
} from '../utils/orderStatus';
import { sendOrderStatusUpdateToCustomer } from '../services/email.service';

const prisma = new PrismaClient();

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
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!signature) {
      console.error('❌ Webhook: Отсутствует подпись');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    if (!webhookSecret) {
      console.error('Webhook: WEBHOOK_SECRET is not configured');
      res.status(503).json({ error: 'Webhook is not configured' });
      return;
    } else {
      const payloadString = canonicalStringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');
      const expected = Buffer.from(expectedSignature, 'utf8');
      const received = Buffer.from(signature, 'utf8');
      const signatureMatches = expected.length === received.length && crypto.timingSafeEqual(expected, received);

      if (!signatureMatches) {
        console.error('❌ Webhook: Неверная подпись');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const { crmOrderId, status, documentNumber, version } = payload;

    if (!crmOrderId || !status) {
      console.error('❌ Webhook: Отсутствуют обязательные поля');
      res.status(400).json({ error: 'Missing crmOrderId or status' });
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(statusMap, status)) {
      res.status(400).json({ error: 'Unknown order status' });
      return;
    }

    if (!Number.isInteger(version) || version < 0) {
      res.status(400).json({ error: 'Invalid or missing status version' });
      return;
    }

    console.log(`📥 Получен вебхук: заказ ${documentNumber || crmOrderId} → статус "${status}"`);

    const siteStatus = statusMap[status];
    console.log(`🔄 Маппинг статуса: ${status} → ${siteStatus}`);

    // ✅ ИЩЕМ ЗАКАЗ ПО crmOrderId
    let order = await prisma.order.findFirst({
      where: {
        crmOrderId: String(crmOrderId),
      },
    });

    if (!order) {
      console.warn(`⚠️ Webhook: Заказ с crmOrderId=${crmOrderId} не найден в БД сайта`);
      res.status(404).json({
        success: false,
        message: `Order with crmOrderId ${crmOrderId} not found`,
      });
      return;
    }

    let applied = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!shouldApplyCrmStatusVersion(order.crmStatusVersion, version)) {
        if (version === order.crmStatusVersion && order.status === siteStatus) {
          try {
            await sendOrderStatusUpdateToCustomer({
              orderId: order.id,
              documentNumber: documentNumber || order.orderNumber || String(crmOrderId),
              customerName: [order.customerFirstName, order.customerMiddleName, order.customerLastName].filter(Boolean).join(' ') || order.guestName || 'Клиент',
              customerEmail: order.customerEmail || order.guestEmail || '',
              status: siteStatus,
              version,
            });
          } catch (emailError) {
            console.error(`❌ Повторная постановка письма о статусе заказа ${order.id} не удалась:`, emailError);
          }
        }
        res.status(200).json({
          success: true,
          idempotent: true,
          message: `CRM status version ${version} was already applied or is stale`,
        });
        return;
      }

      try {
        assertOrderStatusTransition(order.status, siteStatus);
      } catch (error) {
        if (error instanceof InvalidOrderStatusTransitionError) {
          res.status(409).json({ error: error.message });
          return;
        }
        throw error;
      }

      const updated = await prisma.order.updateMany({
        where: {
          id: order.id,
          crmStatusVersion: order.crmStatusVersion,
        },
        data: {
          status: siteStatus,
          crmStatusVersion: version,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 1) {
        applied = true;
        break;
      }

      // Another webhook won the compare-and-swap. Re-read and either apply
      // this newer version from the new state or identify it as stale.
      const currentOrder = await prisma.order.findFirst({
        where: { crmOrderId: String(crmOrderId) },
      });
      if (!currentOrder) {
        res.status(404).json({ success: false, message: 'Order disappeared during status update' });
        return;
      }
      order = currentOrder;
    }

    if (!applied) {
      res.status(409).json({ error: 'Concurrent status update; retry webhook' });
      return;
    }

    console.log(`✅ Webhook: Заказ ${order.id} (crmOrderId: ${crmOrderId}) обновлён → статус "${siteStatus}"`);
    try {
      const customerName = [
        order.customerFirstName,
        order.customerMiddleName,
        order.customerLastName,
      ].filter(Boolean).join(' ') || order.guestName || 'Клиент';
      await sendOrderStatusUpdateToCustomer({
        orderId: order.id,
        documentNumber: documentNumber || order.orderNumber || String(crmOrderId),
        customerName,
        customerEmail: order.customerEmail || order.guestEmail || '',
        status: siteStatus,
        version,
      });
    } catch (emailError) {
      console.error(`❌ Не удалось поставить письмо о статусе заказа ${order.id} в очередь:`, emailError);
    }
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
