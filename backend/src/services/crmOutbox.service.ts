import { Prisma, PrismaClient } from '@prisma/client';
import axios from 'axios';
import { log } from '../config/logger';
import { addOrderToCRMQueue } from '../queues/crm.queue';
import { buildCrmOrderPayload } from './crmOrderPayload.service';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';
import { getInternalApiKey } from '../utils/internalApiKey';

const prisma = new PrismaClient();
const EVENT_TYPE = 'crm_order_create_requested';
const REFUND_EVENT_TYPE = 'payment_refund_requested';
const RECONCILIATION_EVENT_TYPE = 'payment_reconciliation_required';
const CANCELLATION_EVENT_TYPE = 'crm_order_cancellation_requested';
const RESERVATION_RELEASE_EVENT_TYPE = 'crm_reservation_release_requested';
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
  reason: 'pre_handoff_compensation' | 'pre_handoff_customer_cancellation' | 'post_handoff_cancellation' = 'pre_handoff_compensation',
) => db.outboxEvent.upsert({
  where: { deduplicationKey: paymentRefundDeduplicationKey(paymentId) },
  create: {
    aggregateId: orderId,
    type: REFUND_EVENT_TYPE,
    deduplicationKey: paymentRefundDeduplicationKey(paymentId),
    payload: { orderId, paymentId, amountMinor, currency, reason } as Prisma.InputJsonValue,
  },
  // The first deterministic refund intent is immutable. Eligibility checks in
  // the worker reject any later state that is incompatible with that reason.
  update: {},
});

export const paymentRefundDeduplicationKey = (paymentId: string) => `payment-refund:${paymentId}`;

export const crmCancellationDeduplicationKey = (orderId: string) =>
  `crm-order-cancellation:${orderId}`;

export const reservationReleaseDeduplicationKey = (reservationId: string) =>
  `crm-reservation-release:${reservationId}`;

export const ensureCrmCancellationOutboxEvent = async (
  db: OutboxWriter,
  orderId: string,
  crmOrderId: string,
  reason: string,
) => db.outboxEvent.upsert({
  where: { deduplicationKey: crmCancellationDeduplicationKey(orderId) },
  create: {
    aggregateId: orderId,
    type: CANCELLATION_EVENT_TYPE,
    deduplicationKey: crmCancellationDeduplicationKey(orderId),
    payload: {
      orderId,
      crmOrderId,
      requestId: crmCancellationDeduplicationKey(orderId),
      reason,
    } as Prisma.InputJsonValue,
  },
  update: {},
});

export const ensureReservationReleaseOutboxEvent = async (
  db: OutboxWriter,
  orderId: string,
  reservationId: string,
) => db.outboxEvent.upsert({
  where: { deduplicationKey: reservationReleaseDeduplicationKey(reservationId) },
  create: {
    aggregateId: orderId,
    type: RESERVATION_RELEASE_EVENT_TYPE,
    deduplicationKey: reservationReleaseDeduplicationKey(reservationId),
    payload: { orderId, reservationId } as Prisma.InputJsonValue,
  },
  update: {},
});

export const paymentReconciliationDeduplicationKey = (paymentId: string) =>
  `payment-reconciliation:${paymentId}`;

export const ensurePaymentReconciliationEvent = async (
  db: OutboxWriter,
  orderId: string,
  paymentId: string,
  orderData: Record<string, unknown>,
) => {
  const deduplicationKey = paymentReconciliationDeduplicationKey(paymentId);
  return db.outboxEvent.upsert({
    where: { deduplicationKey },
    create: {
      aggregateId: orderId,
      type: RECONCILIATION_EVENT_TYPE,
      deduplicationKey,
      payload: { orderId, paymentId, orderData } as Prisma.InputJsonValue,
    },
    update: {},
  });
};

export const acceleratePaymentReconciliationEvent = async (
  db: OutboxWriter,
  eventId: string,
) => db.outboxEvent.updateMany({
  where: { id: eventId, status: 'pending', processedAt: null },
  data: { nextAttemptAt: new Date() },
});

const retryDelayMs = (attempts: number) => Math.min(60_000, 1_000 * (2 ** Math.min(attempts, 6)));

export const dispatchCrmOutboxEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId,
      type: EVENT_TYPE,
      status: 'pending',
      nextAttemptAt: { lte: new Date() },
      processedAt: null,
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
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
      data: { status: 'dispatched', lockedAt: null, lastError: null },
    });
    return true;
  } catch (error: any) {
    const nextAttemptAt = new Date(Date.now() + retryDelayMs(event.attempts));
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
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

export const dispatchPaymentReconciliationEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId,
      type: RECONCILIATION_EVENT_TYPE,
      status: 'pending',
      nextAttemptAt: { lte: new Date() },
      processedAt: null,
    },
    data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;

  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  try {
    const payload = event.payload as {
      orderId?: string; paymentId?: string; orderData?: Record<string, unknown>;
    };
    if (
      !payload.orderId || !payload.paymentId || payload.orderId !== event.aggregateId
      || (payload.orderData?.paymentId && payload.orderData.paymentId !== payload.paymentId)
    ) throw new Error('Invalid payment reconciliation payload');

    const alreadyFulfilled = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, payload.orderId!);
      const [order, attempt] = await Promise.all([
        tx.order.findUnique({ where: { id: payload.orderId } }),
        tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } }),
      ]);
      if (!order) throw new Error('Payment reconciliation order no longer exists');
      if (!order.crmOrderId) return false;
      if (attempt?.providerPaymentId !== payload.paymentId || attempt.status !== 'succeeded') {
        throw new Error('PAYMENT_RECONCILIATION_CONFLICT: CRM order exists in incompatible payment state');
      }
      await tx.outboxEvent.updateMany({
        where: {
          aggregateId: payload.orderId,
          type: { in: [EVENT_TYPE, RECONCILIATION_EVENT_TYPE] },
        },
        data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
      });
      return true;
    });
    if (alreadyFulfilled) return true;

    const refundEvent = await prisma.outboxEvent.findUnique({
      where: { deduplicationKey: paymentRefundDeduplicationKey(payload.paymentId) },
    });
    if (refundEvent) {
      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'processing', processedAt: null },
        data: {
          status: 'completed', processedAt: new Date(), lockedAt: null,
          lastError: 'Durable refund workflow already exists',
        },
      });
      return true;
    }

    let immutableOrderData = payload.orderData;
    if (!immutableOrderData) {
      const original = await prisma.outboxEvent.findUnique({
        where: { deduplicationKey: crmCreateDeduplicationKey(payload.orderId) },
      });
      immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
    }
    if (
      !immutableOrderData
      || immutableOrderData.contractVersion !== 1
      || typeof immutableOrderData.reservationId !== 'string'
      || typeof immutableOrderData.paymentId !== 'string'
    ) {
      throw new Error('Immutable CRM reservation payload is unavailable');
    }

    await addOrderToCRMQueue(payload.orderId, immutableOrderData, { replayCompleted: true });
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
      data: { status: 'dispatched', lockedAt: null, lastError: null },
    });
    return true;
  } catch (error: any) {
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
      data: {
        status: 'pending', lockedAt: null,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
        lastError: String(error?.message || error).slice(0, 1000),
      },
    });
    log.error('Payment reconciliation dispatch failed', {
      eventId, orderId: event.aggregateId, error: error?.message,
    });
    return false;
  }
};

export const dispatchCrmCancellationEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId, type: CANCELLATION_EVENT_TYPE, status: 'pending',
      nextAttemptAt: { lte: new Date() }, processedAt: null,
    },
    data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;
  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  try {
    const payload = event.payload as {
      orderId?: string; crmOrderId?: string; requestId?: string; reason?: string;
    };
    if (
      !payload.orderId || payload.orderId !== event.aggregateId || !payload.crmOrderId
      || payload.requestId !== crmCancellationDeduplicationKey(payload.orderId)
    ) throw new Error('Invalid CRM cancellation payload');

    const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
    const response = await axios.post(
      `${crmApiUrl}/api/sale-documents/internal/v1/orders/${encodeURIComponent(payload.crmOrderId)}/cancellation`,
      {
        requestId: payload.requestId,
        externalOrderId: payload.orderId,
        reason: payload.reason || 'customer_request',
      },
      {
        timeout: 15_000,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': getInternalApiKey() },
      },
    );
    const decision = response.data?.decision;
    if (decision !== 'accepted' && decision !== 'rejected') {
      throw new Error('CRM cancellation response has no authoritative decision');
    }

    await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, payload.orderId!);
      const order = await tx.order.findUnique({ where: { id: payload.orderId } });
      if (!order) throw new Error('Cancellation order no longer exists');
      if (order.crmOrderId !== payload.crmOrderId) {
        throw new Error('CRM cancellation order identity changed');
      }
      if (order.cancellationState === 'requested') {
        await tx.order.update({
          where: { id: order.id },
          data: {
            cancellationState: decision,
            cancellationResolvedAt: new Date(),
            cancellationDecisionReason: String(response.data?.reasonCode || decision).slice(0, 500),
          },
        });
      } else if (order.cancellationState !== decision) {
        throw new Error(`Cancellation state changed to ${order.cancellationState}`);
      }
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: 'processing', processedAt: null },
        data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
      });
    });
    return true;
  } catch (error: any) {
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
      data: {
        status: 'pending', lockedAt: null,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
        lastError: String(error?.message || error).slice(0, 1000),
      },
    });
    log.error('CRM cancellation dispatch failed', {
      eventId, orderId: event.aggregateId, error: error?.message,
    });
    return false;
  }
};

export const dispatchReservationReleaseEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId, type: RESERVATION_RELEASE_EVENT_TYPE, status: 'pending',
      nextAttemptAt: { lte: new Date() }, processedAt: null,
    },
    data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;
  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  try {
    const payload = event.payload as { orderId?: string; reservationId?: string };
    if (!payload.orderId || payload.orderId !== event.aggregateId || !payload.reservationId) {
      throw new Error('Invalid reservation release payload');
    }
    const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
    await axios.post(
      `${crmApiUrl}/api/sale-documents/internal/v1/reservations/${encodeURIComponent(payload.reservationId)}/release`,
      {},
      {
        timeout: 15_000,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': getInternalApiKey() },
      },
    );
    await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, payload.orderId!);
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: 'processing', processedAt: null },
        data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
      });
    });
    return true;
  } catch (error: any) {
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: 'processing', processedAt: null },
      data: {
        status: 'pending', lockedAt: null,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
        lastError: String(error?.message || error).slice(0, 1000),
      },
    });
    log.error('CRM reservation release dispatch failed', {
      eventId, orderId: event.aggregateId, error: error?.message,
    });
    return false;
  }
};

export const dispatchPaymentRefundEvent = async (eventId: string): Promise<boolean> => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: eventId, type: REFUND_EVENT_TYPE, status: 'pending',
      nextAttemptAt: { lte: new Date() }, processedAt: null,
    },
    data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return false;
  const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  const payload = event.payload as {
    orderId?: string; paymentId?: string; amountMinor?: number; currency?: string;
    reason?: 'pre_handoff_compensation' | 'pre_handoff_customer_cancellation' | 'post_handoff_cancellation';
  };
  const reason = payload.reason || 'pre_handoff_compensation';
  try {
    if (
      !payload.orderId || !payload.paymentId || !Number.isSafeInteger(payload.amountMinor)
      || payload.currency !== 'RUB'
      || !['pre_handoff_compensation', 'pre_handoff_customer_cancellation', 'post_handoff_cancellation'].includes(reason)
    ) throw new Error('Invalid refund outbox payload');

    const preflight = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, payload.orderId!);
      const [order, attempt] = await Promise.all([
        tx.order.findUnique({ where: { id: payload.orderId } }),
        tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } }),
      ]);
      if (!order || !attempt || attempt.providerPaymentId !== payload.paymentId) {
        throw new Error('REFUND_RECONCILIATION_REQUIRED: refund identity mismatch');
      }
      if (attempt.status === 'refunded') return { alreadyRefunded: true, refundId: attempt.refundId };
      const postHandoff = reason === 'post_handoff_cancellation';
      const eligible = postHandoff
        ? Boolean(order.crmOrderId && order.status === 'cancelled' && attempt.status === 'refund_required')
        : Boolean(
            !order.crmOrderId && attempt.status === 'compensation_required'
            && (reason !== 'pre_handoff_customer_cancellation'
              || (order.status === 'cancelled' && order.cancellationState === 'accepted'))
          );
      if (!eligible) {
        throw new Error('REFUND_RECONCILIATION_REQUIRED: payment is not eligible for this refund reason');
      }
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          refundReason: reason,
          refundRequestedAt: attempt.refundRequestedAt || new Date(),
          lastCheckedAt: new Date(),
        },
      });
      return { alreadyRefunded: false, refundId: null };
    });

    let refundId = preflight.refundId || null;
    if (!preflight.alreadyRefunded) {
      let refundStatus = 'succeeded';
      refundId = `mock-refund-${payload.paymentId}`;
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
            description: `Automatic ${reason} refund for order ${payload.orderId}`,
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
        refundId = response.data?.id || null;
      }
      if (refundStatus !== 'succeeded') throw new Error(`Refund is ${refundStatus || 'unknown'}`);
    }

    await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, payload.orderId!);
      const attempt = await tx.paymentAttempt.findUnique({ where: { orderId: payload.orderId } });
      if (!attempt || attempt.providerPaymentId !== payload.paymentId) {
        throw new Error('REFUND_RECONCILIATION_REQUIRED: state changed during refund');
      }
      if (attempt.status !== 'refunded') {
        const expectedStatus = reason === 'post_handoff_cancellation' ? 'refund_required' : 'compensation_required';
        const updated = await tx.paymentAttempt.updateMany({
          where: { id: attempt.id, status: expectedStatus },
          data: {
            status: 'refunded', refundReason: reason, refundId,
            refundedAt: new Date(), lastCheckedAt: new Date(), lastError: null,
          },
        });
        if (updated.count !== 1) {
          throw new Error('REFUND_RECONCILIATION_REQUIRED: state changed during refund');
        }
      }
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: 'processing', processedAt: null },
        data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null },
      });
    });
    return true;
  } catch (error: any) {
    const lastError = String(error?.message || error).slice(0, 1000);
    const configuredMax = Number.parseInt(process.env.REFUND_MAX_ATTEMPTS || '8', 10);
    const maxAttempts = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 8;
    if (payload.orderId && event.attempts >= maxAttempts) {
      await prisma.$transaction(async (tx) => {
        await lockPaymentWorkflowOrder(tx, payload.orderId!);
        await tx.paymentAttempt.updateMany({
          where: {
            orderId: payload.orderId,
            providerPaymentId: payload.paymentId,
            status: { in: ['compensation_required', 'refund_required'] },
          },
          data: { status: 'refund_failed', refundReason: reason, lastCheckedAt: new Date(), lastError },
        });
        await tx.outboxEvent.updateMany({
          where: { id: event.id, status: 'processing', processedAt: null },
          data: { status: 'failed', lockedAt: null, lastError },
        });
      });
    } else {
      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'processing', processedAt: null },
        data: {
          status: 'pending', lockedAt: null,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
          lastError,
        },
      });
    }
    log.error('Payment refund dispatch failed', { eventId, orderId: event.aggregateId, error: error?.message });
    return false;
  }
};

export const replayFailedPaymentRefund = async (orderId: string) => prisma.$transaction(async (tx) => {
  await lockPaymentWorkflowOrder(tx, orderId);
  const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
  if (!attempt?.providerPaymentId || attempt.status !== 'refund_failed' || !attempt.refundReason) {
    throw new Error('Payment refund is not in a replayable failed state');
  }
  const event = await tx.outboxEvent.findUnique({
    where: { deduplicationKey: paymentRefundDeduplicationKey(attempt.providerPaymentId) },
  });
  if (!event || event.type !== REFUND_EVENT_TYPE || event.status !== 'failed' || event.processedAt) {
    throw new Error('Failed deterministic refund intent was not found');
  }
  const requiredStatus = attempt.refundReason === 'post_handoff_cancellation'
    ? 'refund_required'
    : 'compensation_required';
  const paymentAttempt = await tx.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: requiredStatus, lastError: null, lastCheckedAt: new Date() },
  });
  const outboxEvent = await tx.outboxEvent.update({
    where: { id: event.id },
    data: {
      status: 'pending', attempts: 0, nextAttemptAt: new Date(), lockedAt: null,
      processedAt: null, lastError: null,
    },
  });
  return { paymentAttempt, outboxEvent };
});

let strandedOrderCursor: string | null = null;

export const reconcileCrmOutbox = async (): Promise<void> => {
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  await prisma.outboxEvent.updateMany({
    where: {
      type: {
        in: [
          EVENT_TYPE, REFUND_EVENT_TYPE, RECONCILIATION_EVENT_TYPE,
          CANCELLATION_EVENT_TYPE, RESERVATION_RELEASE_EVENT_TYPE,
        ],
      },
      OR: [
        { status: 'processing', updatedAt: { lt: staleBefore } },
        { status: 'dispatched', updatedAt: { lt: new Date(Date.now() - 5 * PROCESSING_LEASE_MS) } },
      ],
      processedAt: null,
    },
    data: { status: 'pending', lockedAt: null, nextAttemptAt: new Date() },
  });

  const strandedOrders = await prisma.order.findMany({
    where: {
      status: { in: ['paid', 'crm_failed'] }, crmOrderId: null,
      cancellationState: { notIn: ['requested', 'accepted'] },
    },
    include: {
      user: { select: { firstName: true, lastName: true, middleName: true, phone: true, email: true } },
      paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { id: 'asc' },
    ...(strandedOrderCursor ? { cursor: { id: strandedOrderCursor }, skip: 1 } : {}),
    take: 100,
  });
  strandedOrderCursor = strandedOrders.length === 100
    ? strandedOrders[strandedOrders.length - 1].id
    : null;

  for (const order of strandedOrders) {
    const attempt = order.paymentAttempts[0];
    if (
      order.status === 'crm_failed'
      && attempt?.status === 'compensation_required'
      && attempt.providerPaymentId
    ) {
      const original = await prisma.outboxEvent.findUnique({
        where: { deduplicationKey: crmCreateDeduplicationKey(order.id) },
      });
      const immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
      if (immutableOrderData) {
        await ensurePaymentReconciliationEvent(
          prisma, order.id, attempt.providerPaymentId, immutableOrderData,
        );
      } else {
        log.error('Cannot repair payment reconciliation without immutable CRM payload', { orderId: order.id });
      }
      continue;
    }
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

const runCrmOutboxCycle = async (): Promise<number> => {
  await reconcileCrmOutbox();
  const events = await prisma.outboxEvent.findMany({
    where: {
      type: {
        in: [
          EVENT_TYPE, REFUND_EVENT_TYPE, RECONCILIATION_EVENT_TYPE,
          CANCELLATION_EVENT_TYPE, RESERVATION_RELEASE_EVENT_TYPE,
        ],
      },
      status: 'pending', nextAttemptAt: { lte: new Date() }, processedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 25,
    select: { id: true, type: true },
  });
  const results = await Promise.all(events.map(({ id, type }) => {
    if (type === REFUND_EVENT_TYPE) return dispatchPaymentRefundEvent(id);
    if (type === RECONCILIATION_EVENT_TYPE) return dispatchPaymentReconciliationEvent(id);
    if (type === CANCELLATION_EVENT_TYPE) return dispatchCrmCancellationEvent(id);
    if (type === RESERVATION_RELEASE_EVENT_TYPE) return dispatchReservationReleaseEvent(id);
    return dispatchCrmOutboxEvent(id);
  }));
  return results.filter(Boolean).length;
};

let activeDispatchCycle: Promise<number> | null = null;

export const dispatchCrmOutboxOnce = (): Promise<number> => {
  if (activeDispatchCycle) return activeDispatchCycle;
  activeDispatchCycle = runCrmOutboxCycle().finally(() => { activeDispatchCycle = null; });
  return activeDispatchCycle;
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
