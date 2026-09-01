// backend/src/controllers/webhook.controller.ts (САЙТ)
import { Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  assertOrderStatusTransition,
  InvalidOrderStatusTransitionError,
  shouldApplyCrmStatusVersion,
} from '../utils/orderStatus';
import { sendOrderStatusUpdateToCustomer } from '../services/email.service';
import { lockPaymentWorkflowOrder } from '../services/paymentWorkflowLock.service';
import { ensurePaymentRefundOutboxEvent } from '../services/crmOutbox.service';

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

const ensureAuthoritativeCancellationRefund = async (
  tx: Prisma.TransactionClient,
  order: { id: string; crmOrderId: string | null; status: string },
  now: Date,
) => {
  if (!order.crmOrderId || order.status !== 'cancelled') return;
  const paymentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
  if (
    !paymentAttempt?.providerPaymentId
    || !['succeeded', 'compensation_required', 'refund_failed'].includes(paymentAttempt.status)
  ) return;
  await tx.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: {
      status: paymentAttempt.status === 'refund_failed' ? 'refund_failed' : 'refund_required',
      refundReason: 'post_handoff_cancellation',
      refundRequestedAt: paymentAttempt.refundRequestedAt || now,
      lastCheckedAt: now,
      lastError: paymentAttempt.status === 'refund_failed' ? paymentAttempt.lastError : null,
    },
  });
  await ensurePaymentRefundOutboxEvent(
    tx, order.id, paymentAttempt.providerPaymentId, paymentAttempt.amountMinor,
    paymentAttempt.currency, 'post_handoff_cancellation',
  );
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

    const locatedOrder = await prisma.order.findFirst({
      where: {
        crmOrderId: String(crmOrderId),
      },
    });

    if (!locatedOrder) {
      console.warn(`⚠️ Webhook: Заказ с crmOrderId=${crmOrderId} не найден в БД сайта`);
      res.status(404).json({
        success: false,
        message: `Order with crmOrderId ${crmOrderId} not found`,
      });
      return;
    }

    const projection = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, locatedOrder.id);
      const order = await tx.order.findUnique({ where: { id: locatedOrder.id } });
      if (!order || order.crmOrderId !== String(crmOrderId)) {
        throw new Error('Order identity changed during CRM projection');
      }
      if (!shouldApplyCrmStatusVersion(order.crmStatusVersion, version)) {
        await ensureAuthoritativeCancellationRefund(tx, order, new Date());
        return { applied: false, order };
      }
      assertOrderStatusTransition(order.status, siteStatus);
      const now = new Date();
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: siteStatus,
          crmStatusVersion: version,
          updatedAt: now,
          ...(siteStatus === 'cancelled' && order.cancellationState === 'requested'
            ? {
                cancellationState: 'accepted',
                cancellationResolvedAt: now,
                cancellationDecisionReason: 'authoritative_crm_cancelled',
              }
            : {}),
        },
      });
      await ensureAuthoritativeCancellationRefund(tx, updatedOrder, now);
      return { applied: true, order: updatedOrder };
    }, { maxWait: 5_000, timeout: 10_000 });

    if (!projection.applied) {
      res.status(200).json({
        success: true,
        idempotent: true,
        message: `CRM status version ${version} was already applied or is stale`,
      });
      return;
    }
    const order = projection.order;

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
    if (error instanceof InvalidOrderStatusTransitionError) {
      res.status(409).json({ error: error.message });
      return;
    }
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
