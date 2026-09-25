import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';

export const CRM_DELIVERY_MAX_ATTEMPTS = 8;
export const CRM_DELIVERY_MAX_DELAY_MS = 5 * 60_000;
export const CRM_CREATE_TYPE = 'crm_order_create_requested';
const key = (orderId: string) => `crm-order-create:${orderId}`;
export type DeliveryClaim = { id: string; orderId: string; attempts: number; lockedAt: Date };
export const deliveryClaimWhere = (claim: DeliveryClaim) => ({
  id: claim.id, status: 'processing', processedAt: null,
  attempts: claim.attempts, lockedAt: claim.lockedAt,
});
export function classifyCrmDeliveryError(error: any, now = Date.now()) {
  const status = Number(error?.response?.status) || 0;
  const expired = status === 409 && error?.response?.data?.code === 'RESERVATION_EXPIRED';
  const transient = !status || status === 429 || status >= 500;
  let retryAfterMs = 0;
  const raw = error?.response?.headers?.['retry-after'];
  if (status === 429 && typeof raw === 'string') {
    const delay = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) * 1000 : Date.parse(raw) - now;
    if (Number.isFinite(delay) && delay > 0) retryAfterMs = Math.min(delay, CRM_DELIVERY_MAX_DELAY_MS);
  }
  // Do not persist provider bodies, axios configs, URLs, credentials or personal data.
  return { expired, transient, retryAfterMs, diagnostic: expired ? 'CRM HTTP 409 RESERVATION_EXPIRED'
    : status ? `CRM HTTP ${status}` : 'CRM transport or local finalization failure' };
}
export const crmDeliveryDelayMs = (attempt: number, retryAfterMs = 0) => Math.min(
  CRM_DELIVERY_MAX_DELAY_MS, Math.max(5000 * 2 ** Math.min(Math.max(attempt - 1, 0), 8), retryAfterMs),
);

// Claim ownership independently from the HTTP attempt budget.
export async function claimCrmDelivery(orderId: string) {
  return prisma.$transaction(async tx => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    const event = await tx.outboxEvent.findUnique({ where: { deduplicationKey: key(orderId) } });
    if (!order || order.crmOrderId || !event || event.processedAt || event.status === 'failed') return null;
    const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    if (!['paid', 'crm_failed'].includes(order.status) || order.cancellationState === 'accepted'
      || !attempt || !['succeeded', 'compensation_required'].includes(attempt.status)) return null;
    if (await tx.outboxEvent.findUnique({ where: { deduplicationKey: `payment-refund:${attempt.providerPaymentId}` } })) return null;
    if (!['pending', 'processing', 'dispatched'].includes(event.status) || event.nextAttemptAt > new Date()) return null;
    const payload = event.payload as any;
    // A delivery lease is distinct from the short Redis-dispatch lease.
    if (payload.deliveryInFlight && event.status === 'processing' && event.lockedAt && event.lockedAt.getTime() > Date.now() - 60_000) return null;
    if (event.attempts >= CRM_DELIVERY_MAX_ATTEMPTS) {
      await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lockedAt: null, lastError: 'CRM delivery budget exhausted' } });
      await tx.order.updateMany({ where: { id: orderId, crmOrderId: null, status: { in: ['paid', 'crm_failed'] } }, data: { status: 'crm_failed' } });
      return null;
    }
    const data = payload.orderData;
    if (payload.orderId !== orderId || data?.contractVersion !== 1 || !data.reservationId || !data.paymentId
      || data.reservationId !== attempt.reservationId || data.paymentId !== attempt.providerPaymentId
      || data.paidAmountMinor !== attempt.amountMinor || data.currency !== attempt.currency) {
      await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lockedAt: null, lastError: 'Invalid immutable reserved CRM payload' } });
      return null;
    }
    const lockedAt = new Date();
    const attempts = event.attempts;
    const claimed = await tx.outboxEvent.updateMany({
      where: { id: event.id, status: event.status, attempts: event.attempts, processedAt: null, lockedAt: event.lockedAt },
      data: { status: 'processing', lockedAt, attempts, payload: { ...payload, deliveryInFlight: true } },
    });
    if (claimed.count !== 1) return null;
    return { claim: { id: event.id, orderId, attempts, lockedAt }, orderData: { ...data, externalOrderId: orderId } };
  });
}
// Authorize immediately before axios.post, after all local preflight work.
// Crash ambiguity remains between this durable admission and the socket write;
// conservatively retain that slot rather than exceed the durable upper bound.
export async function beginCrmDeliveryHttpAttempt(claim: DeliveryClaim): Promise<DeliveryClaim | null> {
  const next = { ...claim, attempts: claim.attempts + 1 };
  if (next.attempts > CRM_DELIVERY_MAX_ATTEMPTS) return null;
  const owned = await prisma.outboxEvent.updateMany({
    where: { ...deliveryClaimWhere(claim), nextAttemptAt: { lte: new Date() } },
    data: { attempts: next.attempts },
  });
  return owned.count === 1 ? next : null;
}

export async function finishCrmDeliveryFailure(claim: DeliveryClaim, error: unknown) {
  const classification = classifyCrmDeliveryError(error);
  return prisma.$transaction(async tx => {
    await lockPaymentWorkflowOrder(tx, claim.orderId);
    const terminal = !classification.transient || claim.attempts >= CRM_DELIVERY_MAX_ATTEMPTS;
    const status = terminal ? 'failed' : 'pending';
    const lastError = classification.diagnostic + (terminal && classification.transient ? '; budget exhausted' : '');
    const result = await tx.outboxEvent.updateMany({ where: deliveryClaimWhere(claim), data: {
      status, lockedAt: null, lastError,
      nextAttemptAt: new Date(Date.now() + crmDeliveryDelayMs(claim.attempts, classification.retryAfterMs)),
    } });
    if (result.count !== 1) return false;
    await tx.order.updateMany({ where: { id: claim.orderId, crmOrderId: null, status: { in: ['paid', 'crm_failed'] } }, data: { status: 'crm_failed' } });
    await tx.outboxEvent.updateMany({ where: { aggregateId: claim.orderId, type: 'payment_reconciliation_required', processedAt: null },
      data: { status: terminal ? 'failed' : 'dispatched', lockedAt: null, lastError } });
    return true;
  });
}

// Explicit service-level replay only. Automated scans never reset the budget.
export async function replayFailedCrmDelivery(orderId: string, transaction?: Prisma.TransactionClient) {
  const replay = async (tx: Prisma.TransactionClient) => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    const event = await tx.outboxEvent.findUnique({ where: { deduplicationKey: key(orderId) } });
    const payload = event?.payload as any;
    if (!order || order.crmOrderId || !['paid','crm_failed'].includes(order.status)
      || ['requested','accepted'].includes(order.cancellationState)
      || !attempt || !['succeeded','compensation_required'].includes(attempt.status)
      || !event || event.status !== 'failed' || payload?.orderData?.paymentId !== attempt.providerPaymentId
      || payload?.orderData?.reservationId !== attempt.reservationId
      || payload?.orderData?.contractVersion !== 1) throw new Error('CRM delivery is not replayable');
    const refund = await tx.outboxEvent.findUnique({ where: { deduplicationKey: `payment-refund:${attempt.providerPaymentId}` } });
    if (refund) throw new Error('CRM replay is blocked by refund workflow');
    return tx.outboxEvent.update({ where: { id: event.id }, data: {
      status: 'pending', attempts: 0, nextAttemptAt: new Date(), lockedAt: null, processedAt: null,
      payload: { ...payload, deliveryInFlight: false, previousDeliveryFailure: { attempts: event.attempts, lastError: event.lastError, replayedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
    } });
  };
  return transaction ? replay(transaction) : prisma.$transaction(replay);
}
