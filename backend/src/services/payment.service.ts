// backend/src/services/payment.service.ts
import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { safeRedis } from '../config/redis';
import { 
  sendOrderConfirmationToCustomer,
  sendOrderNotificationToManager,
} from './email.service';
import { log } from '../config/logger';
import { assertOrderStatusTransition } from '../utils/orderStatus';
import { buildCrmOrderPayload } from './crmOrderPayload.service';
import {
  assertCheckoutSnapshotStillCurrent,
  CheckoutInventoryError,
} from './checkoutInventory.service';
import {
  bindProviderPaymentToOrder,
  ensureCrmReservation,
  getOrCreatePaymentAttempt,
  markProviderOutcomeUnknown,
  PaymentPreparationError,
} from './paymentAttempt.service';
import {
  acceleratePaymentReconciliationEvent,
  dispatchCrmOutboxEvent,
  dispatchPaymentReconciliationEvent,
  dispatchPaymentRefundEvent,
  crmCreateDeduplicationKey,
  ensureCrmCreateOutboxEvent,
  ensurePaymentReconciliationEvent,
  ensurePaymentRefundOutboxEvent,
  ensureReservationReleaseOutboxEvent,
  paymentReconciliationDeduplicationKey,
  paymentRefundDeduplicationKey,
} from './crmOutbox.service';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';

const prisma = new PrismaClient();

// ✅ БЕРЁМ ИЗ .ENV
const YOO_KASSA_SHOP_ID = process.env.YOO_KASSA_SHOP_ID || '';
const YOO_KASSA_SECRET_KEY = process.env.YOO_KASSA_SECRET_KEY || '';
const YOO_KASSA_API_URL = 'https://api.yookassa.ru/v3';

type PaymentProvider = 'mock' | 'yookassa';
type MockPayment = {
  id: string;
  status: 'pending' | 'succeeded';
  amount: { value: string; currency: 'RUB' };
  metadata: { orderId: string; reservationId: string; crmOrderId: string; orderNumber: string };
};

const mockPayments = new Map<string, MockPayment>();

export const getPaymentProvider = (): PaymentProvider => {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider !== 'mock' && provider !== 'yookassa') {
    throw new Error('PAYMENT_PROVIDER must be explicitly set to "mock" or "yookassa"');
  }
  if (process.env.NODE_ENV === 'production' && provider === 'mock') {
    throw new Error('Mock payment provider is forbidden in production');
  }
  return provider;
};

const assertYooKassaCredentials = () => {
  if (!YOO_KASSA_SHOP_ID || !YOO_KASSA_SECRET_KEY) {
    throw new Error('YooKassa credentials are not configured');
  }
};

// ============================================================
// ОЧИСТКА ТЕЛЕФОНА
// ============================================================
const cleanPhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.substring(1);
  }
  if (cleaned.length === 11) {
    return '+' + cleaned;
  }
  if (cleaned.length === 10) {
    return '+7' + cleaned;
  }
  return phone;
};

const assertPaymentStartEligible = (order: { status: string; cancellationState?: string }) => {
  if (order.status === 'cancelled' || ['requested', 'accepted'].includes(order.cancellationState || 'none')) {
    throw new PaymentPreparationError(
      'Оплата недоступна во время отмены заказа', 409, 'ORDER_CANCELLATION_ACTIVE',
    );
  }
};

const markProviderRequestStartedIfEligible = async (orderId: string, attemptId: string) =>
  prisma.$transaction(async tx => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!currentOrder) throw new Error('Заказ не найден');
    assertPaymentStartEligible(currentOrder);
    return tx.paymentAttempt.update({
      where: { id: attemptId },
      data: { status: 'initiating', providerRequestStartedAt: new Date(), lastError: null },
    });
  }, { maxWait: 5_000, timeout: 10_000 });

// ============================================================
// СОЗДАНИЕ ПЛАТЕЖА
// ============================================================
// backend/src/services/payment.service.ts

export const createPayment = async (orderId: string, returnUrl: string) => {
  let activeAttemptId: string | null = null;
  let providerRequestStarted = false;
  try {
    // ============================================================
    // 1. ПОЛУЧАЕМ ЗАКАЗ
    // ============================================================
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.status === 'paid') {
      throw new Error('Заказ уже оплачен');
    }
    assertPaymentStartEligible(order);

    if (order.paymentId) {
      const existingPayment = await getPaymentStatus(order.paymentId);
      if (existingPayment?.status === 'pending' || existingPayment?.status === 'succeeded') {
        if (existingPayment.status === 'pending') {
          const existingAttempt = await prisma.paymentAttempt.findUnique({ where: { orderId } });
          if (existingAttempt?.reservationId) await ensureCrmReservation(order, existingAttempt);
        }
        const mockReturnUrl = `${process.env.CLIENT_URL || 'http://localhost:3001'}`
          + `/payment/success?orderId=${orderId}&paymentId=${order.paymentId}&mock=1`;
        return {
          paymentId: order.paymentId,
          paymentUrl: existingPayment?.confirmation?.confirmation_url
            || (getPaymentProvider() === 'mock' ? mockReturnUrl : returnUrl),
          status: existingPayment.status,
          idempotent: true,
        };
      }
    }

    const provider = getPaymentProvider();
    // Serialize first-attempt validation with its durable creation. A sibling
    // request must see the attempt before its reservation consumes free stock.
    // Even an attempt without reservationId can own a CRM reservation after a
    // lost response: recover it by externalOrderId instead of checking free stock.
    let attempt = await prisma.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, orderId);
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new Error('Заказ не найден');
      if (currentOrder.status === 'paid') throw new Error('Заказ уже оплачен');
      assertPaymentStartEligible(currentOrder);
      const existing = await tx.paymentAttempt.findUnique({ where: { orderId } });
      if (existing) return existing;
      await assertCheckoutSnapshotStillCurrent(currentOrder.items as any[], currentOrder.total);
      return getOrCreatePaymentAttempt(currentOrder, provider, tx);
    }, { maxWait: 5_000, timeout: 15_000 });
    activeAttemptId = attempt.id;

    // Recover a provider response that was persisted on the attempt but not yet
    // returned to the browser after a process interruption.
    if (attempt.providerPaymentId) {
      const existingPayment = await getPaymentStatus(attempt.providerPaymentId);
      if (existingPayment?.status === 'pending' || existingPayment?.status === 'succeeded') {
        if (existingPayment.status === 'pending') await ensureCrmReservation(order, attempt);
        return {
          paymentId: attempt.providerPaymentId,
          paymentUrl: existingPayment?.confirmation?.confirmation_url || returnUrl,
          status: existingPayment.status,
          idempotent: true,
        };
      }
    }

    attempt = await ensureCrmReservation(order, attempt);

    if (provider === 'mock') {
      await markProviderRequestStartedIfEligible(orderId, attempt.id);
      providerRequestStarted = true;
      // Match the real provider's per-attempt idempotency under double clicks.
      const mockPaymentId = `mock_${attempt.id}`;
      const mockPayment: MockPayment = mockPayments.get(mockPaymentId) || {
        id: mockPaymentId,
        status: 'pending',
        amount: { value: (attempt.amountMinor / 100).toFixed(2), currency: 'RUB' },
        metadata: {
          orderId: order.id,
          reservationId: attempt.reservationId || '',
          crmOrderId: order.crmOrderId || '',
          orderNumber: order.orderNumber || '',
        },
      };
      await bindProviderPaymentToOrder(attempt.id, orderId, mockPayment.id, mockPayment.status);
      mockPayments.set(mockPayment.id, mockPayment);

      return {
        paymentId: mockPayment.id,
        paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:3001'}`
          + `/payment/success?orderId=${orderId}&paymentId=${mockPayment.id}&mock=1`,
        status: mockPayment.status,
      };
    }

    // ============================================================
    // 3. БОЕВОЙ РЕЖИМ
    // ============================================================
    assertYooKassaCredentials();
    const auth = Buffer.from(`${YOO_KASSA_SHOP_ID}:${YOO_KASSA_SECRET_KEY}`).toString('base64');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Idempotence-Key': attempt.idempotencyKey,
    };

    const items = (order.items as any[]).map((item: any) => ({
      description: item.name || 'Товар',
      quantity: item.quantity,
      amount: {
        value: item.price.toFixed(2),
        currency: 'RUB',
      },
      vat_code: 1,
      payment_subject: 'commodity',
      payment_mode: 'full_payment',
    }));

    if (order.deliveryMethod && order.deliveryMethod !== 'pickup') {
      items.push({
        description: 'Доставка',
        quantity: 1,
        amount: {
          value: '0.00',
          currency: 'RUB',
        },
        vat_code: 1,
        payment_subject: 'service',
        payment_mode: 'full_payment',
      });
    }

    const paymentData = {
      amount: {
        value: (attempt.amountMinor / 100).toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: `Заказ #${order.orderNumber || order.id.slice(0, 8)}`,
      metadata: {
        orderId: order.id,
        reservationId: attempt.reservationId || '',
        crmOrderId: order.crmOrderId || '',
        orderNumber: order.orderNumber || '',
      },
      receipt: {
        customer: {
          email: order.customerEmail || order.guestEmail || undefined,
          phone: order.customerPhone || order.guestPhone || undefined,
        },
        items: items,
      },
    };

    await markProviderRequestStartedIfEligible(orderId, attempt.id);
    providerRequestStarted = true;

    const response = await axios.post(
      `${YOO_KASSA_API_URL}/payments`,
      paymentData,
      { headers }
    );


    await bindProviderPaymentToOrder(attempt.id, orderId, response.data.id, response.data.status);

    return {
      paymentId: response.data.id,
      paymentUrl: response.data.confirmation.confirmation_url,
      status: response.data.status,
    };

  } catch (error: any) {
    if (activeAttemptId && providerRequestStarted) {
      await markProviderOutcomeUnknown(activeAttemptId, error).catch(() => undefined);
    }
    if (error instanceof PaymentPreparationError) throw error;
    // ============================================================
    // 4. ОБРАБОТКА ОШИБОК
    // ============================================================
    
    // ✅ ЕСЛИ ЭТО НАША ОШИБКА — ПРОБРАСЫВАЕМ БЕЗ ИЗМЕНЕНИЙ
    if (
      error instanceof CheckoutInventoryError ||
      error.message === 'Заказ не найден' ||
      error.message === 'Заказ уже оплачен'
    ) {
      throw error;
    }
    
    // ✅ ОШИБКА ЮKASSA
    if (error.response?.data?.description) {
      log.error('YooKassa payment request failed', {
        orderId,
        status: error.response.status,
      });
      throw new Error('Ошибка платёжного провайдера');
    }
    
    // ✅ ДРУГИЕ ОШИБКИ
    log.error('❌ Ошибка создания платежа', { 
      orderId, 
      error: error.message || error 
    });
    throw new Error('Ошибка создания платежа');
  }
};

// ============================================================
// ОБРАБОТКА УСПЕШНОЙ ОПЛАТЫ → ОТПРАВКА В CRM ЧЕРЕЗ ОЧЕРЕДЬ
// ============================================================
export const handlePaymentSuccess = async (orderId: string) => {
  log.info(`🔄 [handlePaymentSuccess] Начало обработки заказа ${orderId}`);
  
  const processedKey = `order:processed:${orderId}`;
  const lockKey = `order:processing:${orderId}`;
  
  // ✅ БЛОКИРУЕМ
  try {
    const processing = await safeRedis.get(lockKey);
    if (processing) {
      log.info(`ℹ️ Заказ ${orderId} уже обрабатывается, пропускаем`);
      // Never acknowledge payment solely from an ephemeral lock. The database
      // CAS and unique outbox key are the authoritative concurrency controls.
    }
    await safeRedis.setex(lockKey, 30, 'true');
    log.debug(`🔒 Заказ ${orderId} заблокирован для обработки`);
  } catch (error) {
    log.warn('⚠️ Ошибка блокировки Redis', { error });
  }
  
  // ✅ ПРОВЕРЯЕМ, НЕ БЫЛ ЛИ УЖЕ ОБРАБОТАН
  try {
    const cached = await safeRedis.get(processedKey);
    if (cached) {
      log.info(`ℹ️ Заказ ${orderId} уже был обработан, пропускаем`);
      // Redis is only an optimization. Continue to verify/repair the durable
      // PostgreSQL outbox after a possible process crash.
    }
  } catch (error) {
    log.warn('⚠️ Ошибка проверки Redis', { error });
  }

  // ✅ ПОЛУЧАЕМ ЗАКАЗ
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          email: true,
        },
      },
      paymentAttempts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    log.error(`❌ Заказ ${orderId} не найден`);
    await safeRedis.del(lockKey);
    throw new Error(`Заказ ${orderId} не найден`);
  }

  log.debug(`📦 Заказ ${orderId} найден`, {
    status: order.status,
    crmOrderId: order.crmOrderId,
    orderNumber: order.orderNumber,
    total: order.total,
  });

  let paymentAttempt = order.paymentAttempts?.[0];

  // Rolling deployment safety: if an older process stored paymentId without
  // creating the additive attempt row, reconstruct the durable link before any
  // fulfillment decision.
  if (!paymentAttempt && order.paymentId) {
    const reconstructed = await getOrCreatePaymentAttempt(
      order,
      order.paymentId.startsWith('mock_') ? 'mock' : 'yookassa',
    );
    paymentAttempt = reconstructed.providerPaymentId
      ? reconstructed
      : await prisma.paymentAttempt.update({
          where: { id: reconstructed.id },
          data: { providerPaymentId: order.paymentId, status: 'unknown', lastCheckedAt: new Date() },
        });
  }

  // Payment truth may arrive after either a locally accepted pre-handoff
  // cancellation or an authoritative CRM-cancelled projection. In both cases
  // fulfillment stays cancelled and payment converges through one durable,
  // deterministic refund intent.
  if (order.status === 'cancelled' || order.cancellationState === 'accepted') {
    const refundEvent = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, order.id);
      const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
      const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
      if (!currentOrder || !currentAttempt?.providerPaymentId) {
        throw new Error('Cancelled order has no durable provider payment identity');
      }
      const postHandoff = Boolean(currentOrder.crmOrderId && currentOrder.status === 'cancelled');
      const preHandoff = Boolean(
        !currentOrder.crmOrderId
        && (currentOrder.status === 'cancelled' || currentOrder.cancellationState === 'accepted')
      );
      if (!postHandoff && !preHandoff) {
        // CRM accepted the cancellation, but its authoritative cancelled
        // projection may still be in the durable status outbox. Persist payment
        // truth now; that projection will atomically create the refund intent.
        if (currentOrder.crmOrderId && currentOrder.cancellationState === 'accepted') {
          await tx.paymentAttempt.update({
            where: { id: currentAttempt.id },
            data: {
              status: ['refunded', 'refund_required', 'refund_failed'].includes(currentAttempt.status)
                ? currentAttempt.status
                : 'succeeded',
              providerConfirmedAt: currentAttempt.providerConfirmedAt || new Date(),
              lastCheckedAt: new Date(),
            },
          });
        }
        return null;
      }
      if (currentAttempt.status === 'refunded') return null;
      const reason = postHandoff
        ? 'post_handoff_cancellation' as const
        : (currentOrder.cancellationState === 'accepted'
          ? 'pre_handoff_customer_cancellation' as const
          : 'pre_handoff_compensation' as const);
      const requiredStatus = postHandoff ? 'refund_required' : 'compensation_required';
      await tx.paymentAttempt.update({
        where: { id: currentAttempt.id },
        data: {
          status: currentAttempt.status === 'refund_failed' ? 'refund_failed' : requiredStatus,
          providerConfirmedAt: currentAttempt.providerConfirmedAt || new Date(),
          lastCheckedAt: new Date(),
          refundReason: reason,
          refundRequestedAt: currentAttempt.refundRequestedAt || new Date(),
          lastError: currentAttempt.status === 'refund_failed' ? currentAttempt.lastError : null,
        },
      });
      if (preHandoff) {
        await tx.outboxEvent.updateMany({
          where: {
            aggregateId: order.id,
            type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
            processedAt: null,
          },
          data: {
            status: 'completed', processedAt: new Date(), lockedAt: null,
            lastError: 'Stopped by cancelled pre-handoff workflow',
          },
        });
        if (currentAttempt.reservationId) {
          await ensureReservationReleaseOutboxEvent(
            tx, order.id, currentAttempt.reservationId,
          );
        }
      }
      return ensurePaymentRefundOutboxEvent(
        tx,
        order.id,
        currentAttempt.providerPaymentId,
        currentAttempt.amountMinor,
        currentAttempt.currency,
        reason,
      );
    }, { maxWait: 5_000, timeout: 10_000 });
    if (refundEvent) await dispatchPaymentRefundEvent(refundEvent.id).catch(() => false);
    await safeRedis.del(lockKey).catch(() => 0);
    return { success: true, orderId, status: 'paid', compensationRequired: true };
  }

  // A durable compensation workflow wins over any duplicate success signal.
  // Re-check under the same Order lock used by CRM/refund workers before a
  // legacy reservation can be acquired or a create event can be repaired.
  if (paymentAttempt?.status === 'compensation_required' && paymentAttempt.providerPaymentId) {
    const recovery = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, order.id);
      const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
      if (
        currentAttempt?.status !== 'compensation_required'
        || currentAttempt.providerPaymentId !== paymentAttempt!.providerPaymentId
      ) return null;
      const refund = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: paymentRefundDeduplicationKey(currentAttempt.providerPaymentId) },
      });
      if (refund) return { kind: 'refund' as const, id: refund.id };
      let reconciliation = await tx.outboxEvent.findUnique({
        where: {
          deduplicationKey: paymentReconciliationDeduplicationKey(currentAttempt.providerPaymentId),
        },
      });
      if (!reconciliation && order.status === 'crm_failed') {
        const original = await tx.outboxEvent.findUnique({
          where: { deduplicationKey: crmCreateDeduplicationKey(order.id) },
        });
        const immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
        if (immutableOrderData) {
          reconciliation = await ensurePaymentReconciliationEvent(
            tx, order.id, currentAttempt.providerPaymentId, immutableOrderData,
          );
        }
      }
      if (reconciliation) {
        await acceleratePaymentReconciliationEvent(tx, reconciliation.id);
        return { kind: 'reconciliation' as const, id: reconciliation.id };
      }
      return { kind: 'guarded' as const, id: null };
    });
    if (recovery?.kind === 'refund') {
      await dispatchPaymentRefundEvent(recovery.id).catch(() => false);
    } else if (recovery?.kind === 'reconciliation') {
      await dispatchPaymentReconciliationEvent(recovery.id).catch(() => false);
    }
    await safeRedis.del(lockKey).catch(() => 0);
    return { success: true, orderId, status: 'paid', alreadyProcessed: true, compensationRequired: true };
  }

  // Pending provider payments that existed during rollout have no reservation.
  // Acquire one before accepting success, or durably refund if stock/price can
  // no longer be honored.
  if (paymentAttempt && !paymentAttempt.reservationId) {
    try {
      paymentAttempt = await ensureCrmReservation(order, paymentAttempt);
    } catch (error: any) {
      if (!paymentAttempt.providerPaymentId) throw error;
      const refundEvent = await prisma.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, order.id);
        const orderUpdated = await tx.order.updateMany({
          where: {
            id: order.id, crmOrderId: null,
            status: { in: ['pending', 'paid', 'crm_failed'] },
          },
          data: { status: 'paid', updatedAt: new Date() },
        });
        const attemptUpdated = await tx.paymentAttempt.updateMany({
          where: {
            id: paymentAttempt!.id,
            status: { notIn: ['refunded', 'canceled'] },
          },
          data: {
            status: 'compensation_required',
            providerConfirmedAt: new Date(),
            lastCheckedAt: new Date(),
            lastError: `Legacy payment could not acquire stock reservation: ${String(error?.message || error).slice(0, 800)}`,
          },
        });
        if (orderUpdated.count !== 1 || attemptUpdated.count !== 1) {
          throw new Error('Legacy refund state changed concurrently');
        }
        return ensurePaymentRefundOutboxEvent(
          tx, order.id, paymentAttempt!.providerPaymentId!, paymentAttempt!.amountMinor, paymentAttempt!.currency,
        );
      });
      await dispatchPaymentRefundEvent(refundEvent.id).catch(() => false);
      await safeRedis.del(lockKey);
      return { success: true, orderId, status: 'paid', compensationRequired: true };
    }
  }

  const baseCrmPayload = buildCrmOrderPayload(order);
  const durableCrmPayload = paymentAttempt?.reservationId && order.paymentId
    ? {
        ...baseCrmPayload,
        reservationId: paymentAttempt.reservationId,
        paymentId: order.paymentId,
        paidAmountMinor: paymentAttempt.amountMinor,
        currency: paymentAttempt.currency,
        contractVersion: 1,
      }
    : baseCrmPayload;

  if (
    order.status === 'crm_failed'
    && !order.crmOrderId
    && paymentAttempt?.status === 'compensation_required'
    && paymentAttempt.providerPaymentId
  ) {
    const reconciliation = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, order.id);
      const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
      const currentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: order.id } });
      if (
        !currentOrder || currentOrder.crmOrderId || currentOrder.status !== 'crm_failed'
        || currentAttempt?.status !== 'compensation_required'
        || currentAttempt.providerPaymentId !== paymentAttempt.providerPaymentId
      ) return null;
      const refundWorkflow = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: paymentRefundDeduplicationKey(currentAttempt.providerPaymentId) },
      });
      if (refundWorkflow) return null;
      const original = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: crmCreateDeduplicationKey(order.id) },
      });
      const immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
      if (!immutableOrderData) {
        throw new Error('Immutable CRM payload is unavailable for payment reconciliation');
      }
      const event = await ensurePaymentReconciliationEvent(
        tx, order.id, currentAttempt.providerPaymentId, immutableOrderData,
      );
      await acceleratePaymentReconciliationEvent(tx, event.id);
      return event;
    });
    if (reconciliation) {
      await dispatchPaymentReconciliationEvent(reconciliation.id).catch(() => false);
    }
    await safeRedis.del(lockKey).catch(() => 0);
    return { success: true, orderId, status: 'paid', alreadyProcessed: true, compensationRequired: true };
  }

  if (order.status !== 'pending' && order.status !== 'crm_failed') {
    if (order.status === 'paid' && !order.crmOrderId) {
      const repairedEvent = await ensureCrmCreateOutboxEvent(prisma, order.id, durableCrmPayload);
      await dispatchCrmOutboxEvent(repairedEvent.id).catch(() => false);
    }
    log.info(`ℹ️ Оплата заказа ${orderId} уже обработана, пропускаем`);
    await safeRedis.del(lockKey);
    return { success: true, orderId, status: 'paid', alreadyProcessed: true };
  }

  assertOrderStatusTransition(order.status, 'paid');
  const { claimed, outboxEvent } = await prisma.$transaction(async (tx) => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!currentOrder) throw new Error(`Заказ ${orderId} не найден`);
    const claimedResult = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { in: ['pending', 'crm_failed'] },
        cancellationState: { notIn: ['requested', 'accepted'] },
      },
      data: { status: 'paid', updatedAt: new Date() },
    });
    if (claimedResult.count !== 1) return { claimed: claimedResult, outboxEvent: null };

    if (paymentAttempt) {
      await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: { status: 'succeeded', providerConfirmedAt: new Date(), lastCheckedAt: new Date() },
      });
    }
    const event = currentOrder.crmOrderId
      ? null
      : await ensureCrmCreateOutboxEvent(tx, order.id, durableCrmPayload);
    return { claimed: claimedResult, outboxEvent: event };
  });
  if (claimed.count !== 1) {
    await safeRedis.del(lockKey);
    const latestOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (latestOrder?.status === 'cancelled' || latestOrder?.cancellationState === 'accepted') {
      return handlePaymentSuccess(orderId);
    }
    return { success: true, orderId, status: 'paid', alreadyProcessed: true };
  }

  if (outboxEvent) {
    await dispatchCrmOutboxEvent(outboxEvent.id).catch(() => false);
  }

  log.info(`✅ Заказ ${orderId} оплачен!`);

  // ✅ 1. ОТПРАВЛЯЕМ ЗАКАЗ В CRM ЧЕРЕЗ ОЧЕРЕДЬ
  if (!order.crmOrderId) {
    try {
      const phone = cleanPhone(order.customerPhone || order.guestPhone || order.user?.phone || '');
      
      const orderData = {
        items: (order.items as any[]).map((item: any) => ({
          productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
          quantity: item.quantity || 1,
          price: item.price || 0,
        })),
        client: {
          firstName: order.user?.firstName || 'Клиент',
          lastName: order.user?.lastName || '',
          middleName: order.user?.middleName || '',
          phone: phone || '+79999999999',
          email: order.customerEmail || order.guestEmail || order.user?.email || '',
          city: '',
          address: order.deliveryAddress || '',
        },
        deliveryMethod: order.deliveryMethod || 'pickup',
        deliveryAddress: order.deliveryAddress || '',
        comment: order.comment || '',
        source: 'website'
      };

      // ✅ ДОБАВЛЯЕМ В ОЧЕРЕДЬ, А НЕ ОТПРАВЛЯЕМ ПРЯМО
      // The transactional outbox above is the sole CRM publisher. Keeping the
      // former direct Bull call here would recreate a DB/Redis split-brain path.
      log.info(`✅ Заказ ${orderId} добавлен в очередь CRM`);
    } catch (error: any) {
      log.error(`❌ Ошибка добавления заказа ${orderId} в очередь`, { error: error.message });
      await prisma.order.updateMany({
        where: { id: orderId, status: 'paid' },
        data: { status: 'crm_failed', updatedAt: new Date() },
      });
      await safeRedis.del(lockKey);
      throw new Error('Оплата подтверждена, но синхронизация с CRM не запущена');
    }
  } else {
    log.info(`ℹ️ Заказ ${orderId} уже имеет crmOrderId: ${order.crmOrderId}, пропускаем отправку в CRM`);
  }

  // ✅ 2. ОЧИЩАЕМ КОРЗИНУ
  if (order.userId) {
    try {
      await prisma.cart.update({
        where: { userId: order.userId },
        data: { items: [] },
      });
      log.debug(`🧹 Корзина очищена для пользователя: ${order.userId}`);
    } catch (error) {
      log.warn(`⚠️ Не удалось очистить корзину для ${order.userId}`, { error });
    }
  }

  // ✅ 3. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ
  try {
    const emailData = {
      orderId: order.id,
      documentNumber: order.orderNumber || order.id.slice(0, 8),
      customerName: [order.customerFirstName, order.customerMiddleName, order.customerLastName].filter(Boolean).join(' ') || order.guestName || [order.user?.firstName, order.user?.middleName, order.user?.lastName].filter(Boolean).join(' ') || 'Клиент',
      customerEmail: order.customerEmail || order.guestEmail || order.user?.email || '',
      customerPhone: order.customerPhone || order.guestPhone || order.user?.phone || '',
      total: order.total,
      items: (order.items as any[]).map((item: any) => ({
        name: item.name || 'Товар',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      })),
      deliveryAddress: order.deliveryAddress || '',
      comment: order.comment || '',
      paymentId: order.paymentId || 'test',
    };

    await sendOrderConfirmationToCustomer(emailData);
    await sendOrderNotificationToManager(emailData);
    log.info(`✅ Уведомления поставлены в очередь для заказа ${orderId}`);
  } catch (emailError) {
    log.error(`❌ Ошибка отправки email для заказа ${orderId}`, { error: emailError });
  }

  // ✅ 5. СОХРАНЯЕМ В REDIS
  try {
    await safeRedis.setex(processedKey, 7 * 24 * 60 * 60, 'true');
    await safeRedis.del(lockKey);
    log.debug(`✅ Ключи сохранены в Redis, блокировка снята`);
  } catch (error) {
    log.warn('⚠️ Не удалось сохранить в Redis', { error });
  }

  log.info(`✅ [handlePaymentSuccess] Заказ ${orderId} успешно обработан`);
  return { 
    success: true, 
    orderId, 
    status: 'paid',
  };
};

// ============================================================
// ОБРАБОТКА WEBHOOK
// ============================================================
export const handlePaymentWebhook = async (event: any) => {
  log.info('YooKassa webhook received', { status: event.object?.status });

  const payment = event.object;
  
  if (!payment || !payment.metadata) {
    log.error('❌ Невалидный webhook: нет metadata');
    throw new Error('Невалидный webhook');
  }

  const { orderId } = payment.metadata;
  const status = payment.status;

  if (!orderId) {
    log.error('❌ Webhook: нет orderId в metadata');
    throw new Error('Нет orderId в metadata');
  }

  if (status === 'succeeded') {
    log.info(`✅ Webhook: оплата заказа ${orderId} успешна`);
    return await handlePaymentSuccess(orderId);
  }

  if (status === 'canceled') {
    const paymentState = await prisma.$transaction(async (tx) => {
      await lockPaymentWorkflowOrder(tx, orderId);
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new Error(`Заказ ${orderId} не найден`);
      const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
      if (
        attempt?.status === 'succeeded'
        || attempt?.status === 'compensation_required'
        || attempt?.status === 'refund_required'
        || attempt?.status === 'refund_failed'
        || attempt?.status === 'refunded'
      ) {
        if (attempt) {
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              lastCheckedAt: new Date(),
              lastError: 'PAYMENT_CANCELLATION_CONFLICT: fulfil/refund decision requires operator review',
            },
          });
        }
        return { conflict: true as const };
      }
      if (attempt) {
        const attemptUpdated = await tx.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              notIn: ['succeeded', 'compensation_required', 'refund_required', 'refund_failed', 'refunded'],
            },
          },
          data: { status: 'canceled', lastCheckedAt: new Date(), lastError: null },
        });
        if (attemptUpdated.count !== 1) throw new Error('Payment cancellation state changed concurrently');
        if (attempt.reservationId) {
          await ensureReservationReleaseOutboxEvent(tx, orderId, attempt.reservationId);
        }
      }
      return { conflict: false as const };
    }, { maxWait: 5_000, timeout: 10_000 });
    if (paymentState.conflict) {
      throw new Error('PAYMENT_CANCELLATION_CONFLICT: operator review required');
    }
    log.info(`Webhook: платёж заказа ${orderId} отменён; fulfillment status не изменён`);
    return { success: true, orderId, status: 'canceled' };
  }

  log.info(`ℹ️ Webhook: заказ ${orderId}, статус ${status} (не обрабатывается)`);
  return { success: true, orderId, status };
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ПЛАТЕЖА
// ============================================================
export const getPaymentStatus = async (paymentId: string) => {
  if (getPaymentProvider() === 'mock') {
    const payment = mockPayments.get(paymentId);
    if (!payment) throw new Error('Mock payment not found');
    return { ...payment, amount: { ...payment.amount }, metadata: { ...payment.metadata } };
  }

  try {
    assertYooKassaCredentials();
    const auth = Buffer.from(`${YOO_KASSA_SHOP_ID}:${YOO_KASSA_SECRET_KEY}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    };

    const response = await axios.get(
      `${YOO_KASSA_API_URL}/payments/${paymentId}`,
      { headers }
    );
    return response.data;
  } catch (error: any) {
    log.error('❌ Ошибка получения статуса платежа', { error: error.message });
    throw new Error('Ошибка получения статуса платежа');
  }
};

export const completeMockPayment = (paymentId: string, orderId: string) => {
  if (process.env.NODE_ENV === 'production' || getPaymentProvider() !== 'mock') {
    throw new Error('Mock payment completion is unavailable');
  }

  const payment = mockPayments.get(paymentId);
  if (!payment || payment.metadata.orderId !== orderId) {
    throw new Error('Mock payment not found for this order');
  }

  payment.status = 'succeeded';
  return { ...payment, amount: { ...payment.amount }, metadata: { ...payment.metadata } };
};

export const resetMockPaymentsForTests = () => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test helper is unavailable');
  mockPayments.clear();
};

// ============================================================
// ПРИНУДИТЕЛЬНАЯ ОТПРАВКА ЗАКАЗА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
export const resendOrderToCRM = async (orderId: string): Promise<any> => {
  log.info(`🔄 [resendOrderToCRM] Принудительная отправка заказа ${orderId} в CRM`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: { firstName: true, lastName: true, middleName: true, phone: true, email: true },
      },
    },
  });

  if (!order) {
    throw new Error(`Заказ ${orderId} не найден`);
  }

  if (order.crmOrderId) {
    throw new Error(`Заказ ${orderId} уже отправлен в CRM (crmOrderId: ${order.crmOrderId})`);
  }

  if (order.status !== 'paid' && order.status !== 'crm_failed') {
    throw new Error(`Заказ ${orderId} не оплачен (статус: ${order.status})`);
  }

  const reconciliation = await prisma.$transaction(async (tx) => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!currentOrder || currentOrder.crmOrderId) {
      throw new Error(`Заказ ${orderId} уже обработан или не найден`);
    }
    if (currentOrder.status !== 'paid' && currentOrder.status !== 'crm_failed') {
      throw new Error(`Состояние заказа ${orderId} изменилось`);
    }
    const paymentAttempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    if (!paymentAttempt?.providerPaymentId || !paymentAttempt.reservationId) {
      throw new Error(`Заказ ${orderId} не имеет durable payment reservation`);
    }
    if (paymentAttempt.status === 'refunded' || paymentAttempt.status === 'canceled') {
      throw new Error(`Платёж заказа ${orderId} уже ${paymentAttempt.status}`);
    }
    const refund = await tx.outboxEvent.findUnique({
      where: { deduplicationKey: paymentRefundDeduplicationKey(paymentAttempt.providerPaymentId) },
    });
    if (refund) throw new Error(`Для заказа ${orderId} уже запущен durable refund workflow`);
    const original = await tx.outboxEvent.findUnique({
      where: { deduplicationKey: crmCreateDeduplicationKey(orderId) },
    });
    const immutableOrderData = (original?.payload as { orderData?: Record<string, unknown> } | undefined)?.orderData;
    if (!immutableOrderData) throw new Error(`Immutable CRM payload для заказа ${orderId} не найден`);
    const event = await ensurePaymentReconciliationEvent(
      tx, orderId, paymentAttempt.providerPaymentId, immutableOrderData,
    );
    await acceleratePaymentReconciliationEvent(tx, event.id);
    return event;
  });
  await dispatchPaymentReconciliationEvent(reconciliation.id).catch(() => false);
  return { success: true, orderId, queued: true, crmOrderId: null, documentNumber: null };
};
