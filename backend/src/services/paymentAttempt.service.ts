import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getInternalApiKey } from '../utils/internalApiKey';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';

const prisma = new PrismaClient();
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

type OrderSnapshot = {
  id: string;
  total: number;
  items: unknown;
};

export class PaymentPreparationError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
    public readonly code = 'PAYMENT_PREPARATION_FAILED',
  ) {
    super(message);
    this.name = 'PaymentPreparationError';
  }
}

const normalizedItems = (items: unknown) => {
  if (!Array.isArray(items)) throw new PaymentPreparationError('Некорректный состав заказа');
  return items.map((item: any) => ({
    productId: typeof item?.productId === 'string' ? Number.parseInt(item.productId, 10) : item?.productId,
    quantity: item?.quantity,
  }));
};

export const getOrCreatePaymentAttempt = async (order: OrderSnapshot, provider: string) => {
  const existing = await prisma.paymentAttempt.findUnique({ where: { orderId: order.id } });
  if (existing) return existing;

  try {
    return await prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider,
        idempotencyKey: `payment-attempt-${randomUUID()}`,
        amountMinor: Math.round(order.total * 100),
        currency: 'RUB',
        status: 'initiating',
      },
    });
  } catch (error: any) {
    // A concurrent request may have created the unique per-order attempt.
    if (error?.code === 'P2002') {
      const concurrent = await prisma.paymentAttempt.findUnique({ where: { orderId: order.id } });
      if (concurrent) return concurrent;
    }
    throw error;
  }
};

export const ensureCrmReservation = async (order: OrderSnapshot, attempt: any) => {
  if (attempt.reservationId) {
    const expiresAt = attempt.reservationExpiresAt ? new Date(attempt.reservationExpiresAt).getTime() : 0;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
      throw new PaymentPreparationError(
        'Время резерва товара истекло. Оформите заказ повторно',
        409,
        'RESERVATION_EXPIRED',
      );
    }
    return attempt;
  }

  try {
    const response = await axios.post(
      `${CRM_API_URL}/api/sale-documents/internal/v1/reservations`,
      {
        externalOrderId: order.id,
        items: normalizedItems(order.items),
        currency: 'RUB',
      },
      {
        timeout: 15_000,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': getInternalApiKey() },
      },
    );
    const reservation = response.data;
    if (
      typeof reservation?.reservationId !== 'string'
      || reservation?.status !== 'active'
      || reservation?.currency !== 'RUB'
      || !Number.isSafeInteger(reservation?.totalMinor)
      || !Array.isArray(reservation?.items)
    ) {
      throw new PaymentPreparationError('CRM вернула некорректную резервацию', 502);
    }

    const expectedMinor = Math.round(order.total * 100);
    const snapshotItems = Array.isArray(order.items) ? order.items as any[] : [];
    const snapshotByProduct = new Map(snapshotItems.map((item) => [
      Number(item.productId),
      { quantity: item.quantity, unitPriceMinor: Math.round(Number(item.price) * 100) },
    ]));
    const lineMismatch = reservation.items.length !== snapshotByProduct.size
      || reservation.items.some((item: any) => {
        const snapshot = snapshotByProduct.get(Number(item.productId));
        return !snapshot
          || snapshot.quantity !== item.quantity
          || snapshot.unitPriceMinor !== item.unitPriceMinor;
      });
    if (reservation.totalMinor !== expectedMinor || lineMismatch) {
      await releaseCrmReservation(reservation.reservationId).catch(() => undefined);
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'failed', lastError: 'CRM reservation price differs from order snapshot' },
      });
      throw new PaymentPreparationError(
        'Цена заказа изменилась. Обновите корзину и повторите оформление',
        409,
        'ORDER_PRICE_CHANGED',
      );
    }

    const finalized = await prisma.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, order.id);
      const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
      const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
      if (!currentOrder || !currentAttempt || currentAttempt.id !== attempt.id) {
        throw new Error('Payment reservation identity changed');
      }
      const paymentAttempt = await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          reservationId: reservation.reservationId,
          reservationExpiresAt: reservation.expiresAt ? new Date(reservation.expiresAt) : null,
          amountMinor: reservation.totalMinor,
          currency: reservation.currency,
          lastError: null,
        },
      });
      const cancellationActive = currentOrder.status === 'cancelled'
        || ['requested', 'accepted'].includes(currentOrder.cancellationState);
      if (cancellationActive) {
        await tx.outboxEvent.upsert({
          where: { deduplicationKey: `crm-reservation-release:${reservation.reservationId}` },
          create: {
            aggregateId: order.id,
            type: 'crm_reservation_release_requested',
            deduplicationKey: `crm-reservation-release:${reservation.reservationId}`,
            payload: { orderId: order.id, reservationId: reservation.reservationId },
          },
          update: {},
        });
      }
      return { paymentAttempt, cancellationActive };
    }, { maxWait: 5_000, timeout: 10_000 });
    if (finalized.cancellationActive) {
      throw new PaymentPreparationError(
        'Оплата недоступна во время отмены заказа', 409, 'ORDER_CANCELLATION_ACTIVE',
      );
    }
    return finalized.paymentAttempt;
  } catch (error: any) {
    if (error instanceof PaymentPreparationError) throw error;
    const status = error?.response?.status;
    const code = error?.response?.data?.code || 'RESERVATION_FAILED';
    const message = error?.response?.data?.message || error?.response?.data?.error || 'Не удалось зарезервировать товар';
    // A timeout is ambiguous: the CRM may have committed the reservation. Keep
    // the attempt non-terminal so a retry uses the same externalOrderId.
    if (!error?.response) {
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'unknown', lastError: String(error?.message || error).slice(0, 1000) },
      });
    } else {
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'failed', lastError: String(message).slice(0, 1000) },
      });
    }
    throw new PaymentPreparationError(message, status === 409 ? 409 : 503, code);
  }
};

export const markProviderRequestStarted = (attemptId: string) => prisma.paymentAttempt.update({
  where: { id: attemptId },
  data: { status: 'initiating', providerRequestStartedAt: new Date(), lastError: null },
});

export const bindProviderPaymentToOrder = (
  attemptId: string,
  orderId: string,
  providerPaymentId: string,
  status: string,
) => prisma.$transaction(async tx => {
  await lockPaymentWorkflowOrder(tx, orderId);
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Payment order no longer exists');
  const paymentAttempt = await tx.paymentAttempt.update({
    where: { id: attemptId },
    data: {
      providerPaymentId,
      status: status === 'succeeded' ? 'succeeded' : 'pending',
      providerConfirmedAt: status === 'succeeded' ? new Date() : null,
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });
  await tx.order.update({ where: { id: orderId }, data: { paymentId: providerPaymentId } });
  return paymentAttempt;
}, { maxWait: 5_000, timeout: 10_000 });

export const markProviderOutcomeUnknown = (attemptId: string, error: unknown) => prisma.paymentAttempt.update({
  where: { id: attemptId },
  data: { status: 'unknown', lastError: String((error as any)?.message || error).slice(0, 1000) },
});

export const releaseCrmReservation = async (reservationId: string) => {
  await axios.post(
    `${CRM_API_URL}/api/sale-documents/internal/v1/reservations/${encodeURIComponent(reservationId)}/release`,
    {},
    { timeout: 15_000, headers: { 'X-API-Key': getInternalApiKey() } },
  );
};

export const markPaymentAttemptCanceled = async (orderId: string) => {
  const attempt = await prisma.paymentAttempt.findUnique({ where: { orderId } });
  if (!attempt) return;
  if (attempt.reservationId) await releaseCrmReservation(attempt.reservationId);
  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: 'canceled', lastCheckedAt: new Date(), lastError: null },
  });
};
