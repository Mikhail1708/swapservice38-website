import { Prisma } from '@prisma/client';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';

import { prisma } from '../config/prisma';
const CANCELLATION_WINDOW_MS = 12 * 60 * 60 * 1000;

export class OrderCancellationError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'OrderCancellationError';
  }
}

type LockedOrder = Awaited<ReturnType<Prisma.TransactionClient['order']['findUnique']>>;
type LockedAttempt = Awaited<ReturnType<Prisma.TransactionClient['paymentAttempt']['findUnique']>>;

export const acceptPreHandoffCancellation = async (
  tx: Prisma.TransactionClient,
  order: NonNullable<LockedOrder>,
  attempt: LockedAttempt,
  reason: string,
  decisionReason = 'pre_handoff_accepted',
) => {
  if (order.crmOrderId) throw new Error('Pre-handoff cancellation cannot accept a CRM order');
  const now = new Date();
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'cancelled',
      cancellationState: 'accepted',
      cancellationRequestedAt: order.cancellationRequestedAt || now,
      cancellationResolvedAt: now,
      cancellationReason: order.cancellationReason || reason,
      cancellationDecisionReason: decisionReason,
    },
  });

  await tx.outboxEvent.updateMany({
    where: {
      aggregateId: order.id,
      type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
      processedAt: null,
    },
    data: {
      status: 'completed', processedAt: now, lockedAt: null,
      lastError: 'Stopped by accepted pre-handoff customer cancellation',
    },
  });

  if (attempt?.reservationId) {
    await tx.outboxEvent.upsert({
      where: { deduplicationKey: `crm-reservation-release:${attempt.reservationId}` },
      create: {
        aggregateId: order.id,
        type: 'crm_reservation_release_requested',
        deduplicationKey: `crm-reservation-release:${attempt.reservationId}`,
        payload: { orderId: order.id, reservationId: attempt.reservationId },
      },
      update: {},
    });
  }

  if (attempt?.providerPaymentId && ['succeeded', 'compensation_required'].includes(attempt.status)) {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'compensation_required',
        refundReason: 'pre_handoff_customer_cancellation',
        refundRequestedAt: attempt.refundRequestedAt || now,
        lastCheckedAt: now,
        lastError: null,
      },
    });
    await tx.outboxEvent.upsert({
      where: { deduplicationKey: `payment-refund:${attempt.providerPaymentId}` },
      create: {
        aggregateId: order.id,
        type: 'payment_refund_requested',
        deduplicationKey: `payment-refund:${attempt.providerPaymentId}`,
        payload: {
          orderId: order.id,
          paymentId: attempt.providerPaymentId,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
          reason: 'pre_handoff_customer_cancellation',
        },
      },
      update: {},
    });
  }
};

export const requestOrderCancellation = async (
  orderId: string,
  userId: string,
  rawReason: unknown,
) => prisma.$transaction(async (tx) => {
  await lockPaymentWorkflowOrder(tx, orderId);
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) {
    throw new OrderCancellationError('Заказ не найден', 404);
  }
  const reason = typeof rawReason === 'string' && rawReason.trim()
    ? rawReason.trim().slice(0, 500)
    : 'customer_request';

  // Once a request is durably recorded, retries remain idempotent even if the
  // original 12-hour eligibility window expires while CRM is deciding it.
  if (['requested', 'accepted', 'rejected'].includes(order.cancellationState)) {
    return tx.order.findUnique({ where: { id: order.id }, include: { paymentAttempts: true } });
  }
  if (Date.now() - order.createdAt.getTime() > CANCELLATION_WINDOW_MS) {
    throw new OrderCancellationError('Срок запроса отмены истёк (12 часов с момента создания)', 409);
  }

  const attempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
  if (order.crmOrderId) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        cancellationState: 'requested',
        cancellationRequestedAt: order.cancellationRequestedAt || new Date(),
        cancellationReason: order.cancellationReason || reason,
        cancellationDecisionReason: null,
      },
    });
    await tx.outboxEvent.upsert({
      where: { deduplicationKey: `crm-order-cancellation:${order.id}` },
      create: {
        aggregateId: order.id,
        type: 'crm_order_cancellation_requested',
        deduplicationKey: `crm-order-cancellation:${order.id}`,
        payload: {
          orderId: order.id,
          crmOrderId: order.crmOrderId,
          requestId: `crm-order-cancellation:${order.id}`,
          reason,
        },
      },
      update: {},
    });
  } else {
    const handoff = await tx.outboxEvent.findFirst({
      where: {
        aggregateId: order.id,
        processedAt: null,
        OR: [
          {
            type: 'crm_order_create_requested',
            status: { in: ['processing', 'dispatched'] },
          },
          {
            type: 'payment_reconciliation_required',
            status: { in: ['pending', 'processing', 'dispatched'] },
          },
        ],
      },
    });
    if (handoff) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          cancellationState: 'requested',
          cancellationRequestedAt: order.cancellationRequestedAt || new Date(),
          cancellationReason: order.cancellationReason || reason,
          cancellationDecisionReason: 'handoff_in_progress',
        },
      });
    } else {
      await acceptPreHandoffCancellation(tx, order, attempt, reason);
    }
  }
  return tx.order.findUnique({ where: { id: order.id }, include: { paymentAttempts: true } });
}, { maxWait: 5_000, timeout: 10_000 });
