import { Prisma, PrismaClient } from '@prisma/client';
import axios from 'axios';
import { log } from '../config/logger';
import { addOrderToCRMQueue } from '../queues/crm.queue';
import { buildCrmOrderPayload } from './crmOrderPayload.service';

const prisma = new PrismaClient();
const EVENT_TYPE = 'crm_order_create_requested';
const REFUND_EVENT_TYPE = 'payment_refund_requested';
const PROCESSING_LEASE_MS = 60_000;
const DEFAULT_POLL_MS = 5_000;

type OutboxWriter = Prisma.TransactionClient | PrismaClient;

export const crmCreateDeduplicationKey = (orderId: string) => `crm-order-create:${orderId}`;

export const ensureCrmCreateOutboxEvent = async (
  db: OutboxWriter,
  orderId: string,
  orderData: Record<string, unknown>,
) => db.outboxEvent.upsert({
  where: { deduplicationKey: crmCreateDeduplicationKey(orderId) },
  create: {
    aggregateId: orderId,
    type: EVENT_TYPE,
    deduplicationKey: crmCreateDeduplicationKey(orderId),
    payload: { orderId, orderData } as Prisma.InputJsonValue,
  },
  update: {},
});

export const ensurePaymentRefundOutboxEvent = async (
  db: OutboxWriter,
  orderId: string,
  paymentId: string,
  amountMinor: number,
  currency: string,
) => db.outboxEvent.upsert({
  where: { deduplicationKey: `payment-refund:${paymentId}` },
  create: {
    aggregateId: orderId,
    type: REFUND_EVENT_TYPE,
    deduplicationKey: `payment-refund:${paymentId}`,
    payload: { orderId, paymentId, amountMinor, currency } as Prisma.InputJsonValue,
  },
  update: {},
});

const retryDelayMs = (attempts: number) => Math.min(60_000, 1_000 * (2 ** Math.min(attempts, 6)));

export const dispatchCrmOutboxEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId,
      status: 'pending',
      nextAttemptAt: { lte: new Date() },
    },
    data: {
      status: 'processing',
      lockedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count !== 1) return false;

  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  try {
    let payload = event.payload as { orderId?: string; orderData?: Record<string, unknown> };
    if (payload.orderId && !payload.orderData) {
      const order = await prisma.order.findUnique({
        where: { id: payload.orderId },
        include: {
          user: { select: { firstName: true, lastName: true, middleName: true, phone: true, email: true } },
          paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!order) throw new Error('CRM outbox order no longer exists');
      const attempt = order.paymentAttempts[0];
      const basePayload: Record<string, unknown> = buildCrmOrderPayload(order);
      const orderData = attempt?.reservationId && attempt.providerPaymentId
        ? {
            ...basePayload,
            reservationId: attempt.reservationId,
            paymentId: attempt.providerPaymentId,
            paidAmountMinor: attempt.amountMinor,
            currency: attempt.currency,
            contractVersion: 1,
          }
        : basePayload;
      payload = { orderId: order.id, orderData };
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { payload: payload as Prisma.InputJsonValue },
      });
    }
    if (!payload.orderId || !payload.orderData) throw new Error('Invalid CRM outbox payload');
    await addOrderToCRMQueue(payload.orderId, payload.orderData);
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'dispatched', lockedAt: null, lastError: null },
    });
    return true;
  } catch (error: any) {
    const nextAttemptAt = new Date(Date.now() + retryDelayMs(event.attempts));
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'pending',
        lockedAt: null,
        nextAttemptAt,
        lastError: String(error?.message || error).slice(0, 1000),
      },
    });
    log.error('CRM outbox dispatch failed', { eventId, orderId: event.aggregateId, error: error?.message });
    return false;
  }
};

export const dispatchPaymentRefundEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: { id: eventId, type: REFUND_EVENT_TYPE, status: 'pending', nextAttemptAt: { lte: new Date() } },
    data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;
  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  try {
    const payload = event.payload as {
      orderId?: string; paymentId?: string; amountMinor?: number; currency?: string;
    };
    if (
      !payload.orderId || !payload.paymentId || !Number.isSafeInteger(payload.amountMinor)
      || payload.currency !== 'RUB'
    ) throw new Error('Invalid refund outbox payload');

    let refundStatus = 'succeeded';
    if (process.env.PAYMENT_PROVIDER !== 'mock') {
      const shopId = process.env.YOO_KASSA_SHOP_ID || '';
      const secret = process.env.YOO_KASSA_SECRET_KEY || '';
      if (!shopId || !secret) throw new Error('YooKassa credentials are not configured');
      const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
      const response = await axios.post(
        'https://api.yookassa.ru/v3/refunds',
        {
          payment_id: payload.paymentId,
          amount: { value: ((payload.amountMinor as number) / 100).toFixed(2), currency: payload.currency },
          description: `Automatic refund for unfulfillable order ${payload.orderId}`,
        },
        {
          timeout: 15_000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Idempotence-Key': event.deduplicationKey,
          },
        },
      );
      refundStatus = response.data?.status;
    }
    if (refundStatus !== 'succeeded') throw new Error(`Refund is ${refundStatus || 'unknown'}`);

    await prisma.$transaction([
      prisma.paymentAttempt.updateMany({
        where: { orderId: payload.orderId, providerPaymentId: payload.paymentId },
        data: { status: 'refunded', lastCheckedAt: new Date(), lastError: null },
      }),
      prisma.order.updateMany({
        where: { id: payload.orderId, status: { in: ['paid', 'crm_failed'] } },
        data: { status: 'cancelled', updatedAt: new Date() },
      }),
      prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
      }),
    ]);
    return true;
  } catch (error: any) {
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'pending', lockedAt: null,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
        lastError: String(error?.message || error).slice(0, 1000),
      },
    });
    log.error('Payment refund dispatch failed', { eventId, orderId: event.aggregateId, error: error?.message });
    return false;
  }
};

export const reconcileCrmOutbox = async (): Promise<void> => {
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  await prisma.outboxEvent.updateMany({
    where: {
      type: { in: [EVENT_TYPE, REFUND_EVENT_TYPE] },
      status: { in: ['processing', 'dispatched'] },
      processedAt: null,
      updatedAt: { lt: staleBefore },
    },
    data: { status: 'pending', lockedAt: null, nextAttemptAt: new Date() },
  });

  const strandedOrders = await prisma.order.findMany({
    where: { status: { in: ['paid', 'crm_failed'] }, crmOrderId: null },
    include: {
      user: { select: { firstName: true, lastName: true, middleName: true, phone: true, email: true } },
      paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    take: 100,
  });

  for (const order of strandedOrders) {
    const attempt = order.paymentAttempts[0];
    const basePayload: Record<string, unknown> = buildCrmOrderPayload(order);
    const orderData = attempt?.reservationId && attempt.providerPaymentId
      ? {
          ...basePayload,
          reservationId: attempt.reservationId,
          paymentId: attempt.providerPaymentId,
          paidAmountMinor: attempt.amountMinor,
          currency: attempt.currency,
          contractVersion: 1,
        }
      : basePayload;
    const deduplicationKey = crmCreateDeduplicationKey(order.id);
    const existing = await prisma.outboxEvent.findUnique({ where: { deduplicationKey } });
    const existingPayload = existing?.payload as { orderData?: unknown } | undefined;

    // The additive migration creates repair markers for legacy paid orders. Their
    // immutable CRM payload cannot be assembled safely in SQL, so hydrate only
    // those pending markers once from the current server-side order snapshot.
    if (existing && existing.status === 'pending' && !existingPayload?.orderData) {
      await prisma.outboxEvent.update({
        where: { id: existing.id },
        data: { payload: { orderId: order.id, orderData } as Prisma.InputJsonValue },
      });
    } else {
      await ensureCrmCreateOutboxEvent(prisma, order.id, orderData);
    }
  }
};

export const dispatchCrmOutboxOnce = async (): Promise<number> => {
  await reconcileCrmOutbox();
  const events = await prisma.outboxEvent.findMany({
    where: { type: { in: [EVENT_TYPE, REFUND_EVENT_TYPE] }, status: 'pending', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: 25,
    select: { id: true, type: true },
  });
  const results = await Promise.all(events.map(({ id, type }) => (
    type === REFUND_EVENT_TYPE ? dispatchPaymentRefundEvent(id) : dispatchCrmOutboxEvent(id)
  )));
  return results.filter(Boolean).length;
};

let dispatcherTimer: NodeJS.Timeout | null = null;

export const startCrmOutboxDispatcher = () => {
  if (dispatcherTimer) return;
  const configured = Number.parseInt(process.env.CRM_OUTBOX_POLL_MS || '', 10);
  const pollMs = Number.isFinite(configured) && configured >= 1_000 ? configured : DEFAULT_POLL_MS;
  void dispatchCrmOutboxOnce().catch((error) => log.error('CRM outbox startup dispatch failed', { error }));
  dispatcherTimer = setInterval(() => {
    void dispatchCrmOutboxOnce().catch((error) => log.error('CRM outbox dispatch cycle failed', { error }));
  }, pollMs);
  dispatcherTimer.unref?.();
};

export const stopCrmOutboxDispatcher = () => {
  if (dispatcherTimer) clearInterval(dispatcherTimer);
  dispatcherTimer = null;
};
