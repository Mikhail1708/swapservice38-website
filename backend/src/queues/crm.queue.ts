// backend/src/queues/crm.queue.ts
import Queue from 'bull';
import { beginCrmDeliveryHttpAttempt, claimCrmDelivery, classifyCrmDeliveryError, deliveryClaimWhere, DeliveryClaim, finishCrmDeliveryFailure } from '../services/crmDelivery.service';
import axios from 'axios';
import { log } from '../config/logger';
import { getInternalApiKey } from '../utils/internalApiKey';
import crypto from 'crypto';
import { lockPaymentWorkflowOrder } from '../services/paymentWorkflowLock.service';
import { acceptPreHandoffCancellation } from '../services/orderCancellation.service';

import { prisma } from '../config/prisma';
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

// ============================================================
// СОЗДАНИЕ ОЧЕРЕДИ
// ============================================================
export const getCrmQueueRedisOptions = () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
});

const crmQueue = new Queue('crm queue', {
  redis: getCrmQueueRedisOptions(),
});

// ============================================================
// ТИПЫ ЗАДАЧ
// ============================================================
interface CreateOrderJob {
  type: 'createOrder';
  data: {
    orderId: string;
    orderData: any;
    reconciliationReplay?: boolean;
  };
}

interface UpdateOrderJob {
  type: 'updateOrder';
  data: {
    orderId: string;
    crmOrderId: string;
    orderData: any;
  };
}

type CRMJob = CreateOrderJob | UpdateOrderJob;

// ============================================================
// ОБРАБОТЧИК ОЧЕРЕДИ
// ============================================================
crmQueue.process(async (job) => {
  const { type, data } = job.data as CRMJob;

  log.info(`📥 Обработка задачи CRM: ${type}`, { jobId: job.id });

  try {
    if (type === 'createOrder') {
      return await processCreateOrder(data);
    } else if (type === 'updateOrder') {
      return await processUpdateOrder(data);
    }
  } catch (error: any) {
    log.error(`❌ Ошибка обработки задачи ${type}`, {
      jobId: job.id,
      error: error.message,
      attempt: job.attemptsMade + 1,
    });

    // Если это последняя попытка — сохраняем как failed
    if (job.attemptsMade + 1 >= job.opts.attempts!) {
      await markOrderAsFailed(type, data, error);
    }

    throw error;
  }
});

// ============================================================
// ОБРАБОТЧИК: СОЗДАНИЕ ЗАКАЗА
// ============================================================
export const processCreateOrder = async (data: any) => {
  let claim: DeliveryClaim | null = null;
  let immutableData = data.orderData;
  try {
    return await executeCreateOrder(data, (value, payload) => { claim = value; immutableData = payload; });
  } catch (error) {
    if (!claim) throw error;
    if (classifyCrmDeliveryError(error).expired) {
      await markOrderAsFailed('createOrder', { ...data, orderData: immutableData }, error, claim);
    } else {
      await finishCrmDeliveryFailure(claim, error);
    }
    // PostgreSQL owns scheduling. Bull must not retry independently.
    return { recoveryScheduled: true };
  }
};

const executeCreateOrder = async (data: any, onClaim: (claim: DeliveryClaim, payload: any) => void) => {
  const { orderId, reconciliationReplay = false } = data;
  let orderData = data.orderData;
  let deliveryClaim: DeliveryClaim | null = null;
  let isReservedContract = orderData?.contractVersion === 1 && typeof orderData?.reservationId === 'string';

  log.info(`📤 Отправка заказа ${orderId} в CRM (попытка)`);

  const postToCrm = () => axios.post(
    `${CRM_API_URL}/api/sale-documents/${isReservedContract ? `internal/v1/reservations/${encodeURIComponent(orderData.reservationId)}/consume` : 'public'}`,
    orderData,
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getInternalApiKey(),
      },
    },
  );
  const preflight = await prisma.$transaction(async (tx) => {
    await lockPaymentWorkflowOrder(tx, orderId);
    const eligibleOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!eligibleOrder) throw new Error('Website order no longer exists');
    const eligibleAttempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    const createIntent = await tx.outboxEvent.findUnique({
      where: { deduplicationKey: `crm-order-create:${orderId}` },
    });
    const canonicalData = (createIntent?.payload as any)?.orderData;
    if (canonicalData) orderData = canonicalData;
    isReservedContract = orderData?.contractVersion === 1 && typeof orderData?.reservationId === 'string';
    if (eligibleAttempt?.reservationId && !isReservedContract) {
      throw new Error('Immutable reserved CRM payload is unavailable');
    }
    if (isReservedContract && (!eligibleAttempt || eligibleAttempt.providerPaymentId !== orderData.paymentId)) {
      throw new Error('CRM_ORDER_RECONCILIATION_REQUIRED: payment attempt mismatch');
    }
    if (eligibleAttempt?.providerPaymentId) {
      const refundIntent = await tx.outboxEvent.findUnique({
        where: { deduplicationKey: `payment-refund:${eligibleAttempt.providerPaymentId}` },
      });
      if (refundIntent) {
        await tx.outboxEvent.updateMany({
          where: {
            aggregateId: orderId,
            type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
            processedAt: null,
          },
          data: {
            status: 'completed', processedAt: new Date(), lockedAt: null,
            lastError: 'CRM handoff stopped by durable refund intent',
          },
        });
        return { skip: true };
      }
    }

    const createIntentPayload = createIntent?.payload
      && typeof createIntent.payload === 'object'
      && !Array.isArray(createIntent.payload)
      ? createIntent.payload as Record<string, unknown>
      : {};
    const handoffWasAttempted = reconciliationReplay
      || createIntentPayload.handoffAttempted === true;
    if (
      eligibleOrder.cancellationState === 'requested'
      && !eligibleOrder.crmOrderId
      && !handoffWasAttempted
    ) {
      await acceptPreHandoffCancellation(
        tx,
        eligibleOrder,
        eligibleAttempt,
        eligibleOrder.cancellationReason || 'customer_request',
        'accepted_before_crm_handoff',
      );
      return { skip: true };
    }
    if (
      eligibleOrder.cancellationState === 'accepted'
      || eligibleOrder.status === 'cancelled'
      || Boolean(eligibleAttempt && ['refunded', 'canceled', 'refund_required', 'refund_failed'].includes(eligibleAttempt.status))
    ) {
      await tx.outboxEvent.updateMany({
        where: {
          aggregateId: orderId,
          type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
          processedAt: null,
        },
        data: {
          status: 'completed', processedAt: new Date(), lockedAt: null,
          lastError: 'CRM handoff stopped by cancellation/refund state',
        },
      });
      return { skip: true };
    }
    if (createIntent && !handoffWasAttempted) {
      await tx.outboxEvent.updateMany({
        where: { id: createIntent.id, processedAt: null },
        data: {
          payload: { ...createIntentPayload, handoffAttempted: true },
        },
      });
    }
    return { skip: false };
  }, { maxWait: 5_000, timeout: 10_000 });
  if (preflight.skip) return { cancelledBeforeHandoff: true };

  // External HTTP is deliberately outside PostgreSQL. The durable Bull/outbox
  // identity makes timeout-after-commit replay safe, while both preflight and
  // finalize serialize on the common Order row lock.
  if (isReservedContract) {
    const delivery = await claimCrmDelivery(orderId);
    if (!delivery) return { deliveryDeferred: true };
    orderData = delivery.orderData;
    // Resolve configuration before consuming a delivery slot.
    getInternalApiKey();
    deliveryClaim = await beginCrmDeliveryHttpAttempt(delivery.claim);
    if (!deliveryClaim) return { deliveryDeferred: true };
    onClaim(deliveryClaim, orderData);
  }
  const response = await postToCrm();
  const crmResult = response.data;

  const crmStatusMap: Record<string, string> = {
    confirmed: 'confirmed',
    assembling: 'assembling',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  const syncedStatus = crmStatusMap[crmResult.orderStatus] || 'paid';
  const syncedVersion = Number.isInteger(crmResult.statusVersion)
    ? crmResult.statusVersion
    : 0;

  // ✅ Обновляем заказ в БД — сохраняем crmOrderId, НО НЕ МЕНЯЕМ СТАТУС
  const crmOrderId = crmResult.orderId ? String(crmResult.orderId) : null;
  if (!crmOrderId) throw new Error('CRM response has no orderId');

  // Persist the local projection and finish both delivery markers atomically.
  await prisma.$transaction(async (tx) => {
    await lockPaymentWorkflowOrder(tx, orderId);
    if (deliveryClaim) {
      const owned = await tx.outboxEvent.updateMany({ where: deliveryClaimWhere(deliveryClaim), data: { lockedAt: deliveryClaim.lockedAt } });
      if (owned.count !== 1) return;
    }
    const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
    if (!currentOrder) throw new Error('Website order no longer exists');
    if (currentOrder.crmOrderId && currentOrder.crmOrderId !== crmOrderId) {
      throw new Error('CRM_ORDER_RECONCILIATION_REQUIRED: conflicting CRM order id');
    }

    const attempt = await tx.paymentAttempt.findUnique({ where: { orderId } });
    if (isReservedContract) {
      if (!attempt || attempt.providerPaymentId !== orderData.paymentId) {
        throw new Error('CRM_ORDER_RECONCILIATION_REQUIRED: payment attempt mismatch');
      }
      if (['refunded', 'canceled', 'refund_required', 'refund_failed'].includes(attempt.status)) {
        throw new Error(`CRM_ORDER_RECONCILIATION_REQUIRED: payment is ${attempt.status}`);
      }
      const attemptUpdated = await tx.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          providerPaymentId: orderData.paymentId,
          status: { in: ['succeeded', 'compensation_required'] },
        },
        data: { status: 'succeeded', lastCheckedAt: new Date(), lastError: null },
      });
      if (attemptUpdated.count !== 1) {
        throw new Error('CRM_ORDER_RECONCILIATION_REQUIRED: payment state changed concurrently');
      }
    }

    const applyResponseProjection = !currentOrder.crmOrderId
      || syncedVersion > (currentOrder.crmStatusVersion || 0);
    const projectedStatus = applyResponseProjection ? syncedStatus : currentOrder.status;
    const orderUpdated = await tx.order.updateMany({
      where: {
        id: orderId,
        OR: [{ crmOrderId: null }, { crmOrderId }],
      },
      data: {
        crmOrderId,
        orderNumber: crmResult.documentNumber || null,
        status: projectedStatus,
        crmStatusVersion: Math.max(currentOrder.crmStatusVersion || 0, syncedVersion),
        ...(projectedStatus === 'cancelled' && currentOrder.cancellationState === 'requested'
          ? {
              cancellationState: 'accepted',
              cancellationResolvedAt: new Date(),
              cancellationDecisionReason: 'authoritative_crm_cancelled',
            }
          : {}),
      },
    });
    if (orderUpdated.count !== 1) {
      throw new Error('CRM_ORDER_RECONCILIATION_REQUIRED: order state changed concurrently');
    }

    if (
      projectedStatus === 'cancelled'
      && attempt?.providerPaymentId
      && ['succeeded', 'compensation_required', 'refund_failed'].includes(attempt.status)
    ) {
      const now = new Date();
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attempt.status === 'refund_failed' ? 'refund_failed' : 'refund_required',
          refundReason: 'post_handoff_cancellation',
          refundRequestedAt: attempt.refundRequestedAt || now,
          lastCheckedAt: now,
          lastError: attempt.status === 'refund_failed' ? attempt.lastError : null,
        },
      });
      await tx.outboxEvent.upsert({
        where: { deduplicationKey: `payment-refund:${attempt.providerPaymentId}` },
        create: {
          aggregateId: orderId,
          type: 'payment_refund_requested',
          deduplicationKey: `payment-refund:${attempt.providerPaymentId}`,
          payload: {
            orderId,
            paymentId: attempt.providerPaymentId,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            reason: 'post_handoff_cancellation',
          },
        },
        update: {},
      });
    }

    if (currentOrder.cancellationState === 'requested') {
      await tx.outboxEvent.upsert({
        where: { deduplicationKey: `crm-order-cancellation:${orderId}` },
        create: {
          aggregateId: orderId,
          type: 'crm_order_cancellation_requested',
          deduplicationKey: `crm-order-cancellation:${orderId}`,
          payload: {
            orderId,
            crmOrderId,
            requestId: `crm-order-cancellation:${orderId}`,
            reason: currentOrder.cancellationReason || 'customer_request',
          },
        },
        update: {},
      });
    }

    await tx.outboxEvent.updateMany({
      where: {
        aggregateId: orderId,
        type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] },
      },
      data: {
        status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null,
      },
    });
  }, { maxWait: 5_000, timeout: 10_000 });

  log.info(`✅ Заказ ${orderId} отправлен в CRM`, {
    crmOrderId: crmResult.orderId,
    documentNumber: crmResult.documentNumber,
  });

  return crmResult;
};

// ============================================================
// ОБРАБОТЧИК: ОБНОВЛЕНИЕ ЗАКАЗА
// ============================================================
const processUpdateOrder = async (data: any) => {
  const { crmOrderId, orderData } = data;

  log.info(`📤 Обновление заказа ${crmOrderId} в CRM`);

  const response = await axios.put(
    `${CRM_API_URL}/api/sale-documents/internal/${crmOrderId}/full`,
    orderData,
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getInternalApiKey(),
      },
    }
  );

  log.info(`✅ Заказ ${crmOrderId} обновлён в CRM`);
  return response.data;
};

// ============================================================
// МАРКИРОВКА ЗАКАЗА КАК FAILED
// ============================================================
export const markOrderAsFailed = async (type: CRMJob['type'], data: any, cause?: any, claim?: DeliveryClaim) => {
  try {
    if (type === 'createOrder' && data.orderId) {
      const reservationExpired = cause?.response?.data?.code === 'RESERVATION_EXPIRED';
      const reservedContract = data.orderData?.contractVersion === 1
        && typeof data.orderData?.reservationId === 'string';
      if (reservedContract) {
        const attempt = await prisma.paymentAttempt.findUnique({ where: { orderId: data.orderId } });
        if (!attempt?.providerPaymentId) throw new Error('Reserved order has no linked payment attempt');
        const providerError = {
          status: cause?.response?.status || null,
          code: cause?.response?.data?.code || null,
          message: classifyCrmDeliveryError(cause).diagnostic,
        };
        await prisma.$transaction(async (tx) => {
          await lockPaymentWorkflowOrder(tx, data.orderId);
          if (claim) {
            const owned = await tx.outboxEvent.updateMany({ where: deliveryClaimWhere(claim), data: { lockedAt: claim.lockedAt } });
            if (owned.count !== 1) return;
          }
          const lockedAttempt = await tx.paymentAttempt.findUnique({ where: { orderId: data.orderId } });
          if (
            !lockedAttempt?.providerPaymentId
            || lockedAttempt.providerPaymentId !== attempt.providerPaymentId
          ) throw new Error('Reserved payment attempt changed before CRM finalization');
          const lockedOrder = await tx.order.findUnique({ where: { id: data.orderId } });
          if (!lockedOrder) throw new Error('Reserved website order disappeared');
          if (
            reservationExpired
            && lockedOrder.cancellationState === 'requested'
            && !lockedOrder.crmOrderId
          ) {
            await acceptPreHandoffCancellation(
              tx,
              lockedOrder,
              lockedAttempt,
              lockedOrder.cancellationReason || 'customer_request',
              'accepted_after_failed_crm_handoff',
            );
            return;
          }
          const attemptUpdated = await tx.paymentAttempt.updateMany({
            where: { id: lockedAttempt.id, status: { in: ['succeeded', 'compensation_required'] } },
            data: {
              status: 'compensation_required',
              lastError: reservationExpired
                ? 'Reservation expired before CRM consumption'
                : `CRM reservation reconciliation required: ${providerError.message}`,
            },
          });
          if (attemptUpdated.count !== 1) throw new Error('Payment is no longer eligible for CRM recovery');

          const orderUpdated = await tx.order.updateMany({
            where: {
              id: data.orderId,
              status: { in: ['paid', 'crm_failed'] },
              crmOrderId: null,
            },
            data: { status: 'crm_failed', updatedAt: new Date() },
          });
          if (orderUpdated.count !== 1) {
            // A concurrent CRM success/cancellation won. Rolling back here also
            // rolls the attempt transition back, so no false recovery/refund
            // marker can be created by a late failed worker.
            throw new Error('Order is no longer eligible for CRM recovery');
          }
          await tx.outboxEvent.updateMany({
            where: { aggregateId: data.orderId, type: 'crm_order_create_requested', processedAt: null },
            data: {
              status: 'completed', processedAt: new Date(), lockedAt: null,
              lastError: reservationExpired
                ? 'Reservation expired; durable refund requested'
                : 'CRM retries exhausted; durable reconciliation requested',
            },
          });

          if (reservationExpired) {
            await tx.outboxEvent.upsert({
              where: { deduplicationKey: `payment-refund:${lockedAttempt.providerPaymentId}` },
              create: {
                aggregateId: data.orderId,
                type: 'payment_refund_requested',
                deduplicationKey: `payment-refund:${lockedAttempt.providerPaymentId}`,
                payload: {
                  orderId: data.orderId, paymentId: lockedAttempt.providerPaymentId,
                  amountMinor: lockedAttempt.amountMinor, currency: lockedAttempt.currency,
                },
              },
              update: {},
            });
            // The reconciliation marker is terminal only after the refund intent
            // is committed in the same PostgreSQL transaction.
            await tx.outboxEvent.updateMany({
              where: {
                aggregateId: data.orderId,
                type: 'payment_reconciliation_required',
                processedAt: null,
              },
              data: {
                status: 'completed', processedAt: new Date(), lockedAt: null,
                lastError: 'Reservation expired; handed off to durable refund',
              },
            });
          } else {
            // Preflight/legacy Bull failures do not get a fresh reconciliation budget.
            await tx.outboxEvent.updateMany({
              where: { aggregateId: data.orderId, type: { in: ['crm_order_create_requested', 'payment_reconciliation_required'] } },
              data: { status: 'failed', processedAt: null, lockedAt: null, lastError: providerError.message },
            });
          }
        });
        log.error(reservationExpired
          ? `Reservation expired for paid order ${data.orderId}; durable refund requested`
          : `Reserved paid order ${data.orderId} requires durable payment reconciliation`);
        return;
      }
      await prisma.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, data.orderId);
        await tx.order.updateMany({
          where: {
            id: data.orderId,
            crmOrderId: null,
            status: { in: ['paid', 'crm_failed'] },
            cancellationState: { not: 'accepted' },
          },
          data: {
            status: 'crm_failed',
            comment: `Ошибка отправки в CRM: все попытки исчерпаны`,
          },
        });
      }, { maxWait: 5_000, timeout: 10_000 });
      log.error(`❌ Заказ ${data.orderId} помечен как CRM_FAILED`);
    }
  } catch (error) {
    log.error('❌ Ошибка маркировки заказа как failed', { error });
  }
};

// ============================================================
// ФУНКЦИИ ДЛЯ ДОБАВЛЕНИЯ ЗАДАЧ В ОЧЕРЕДЬ
// ============================================================
export const addOrderToCRMQueue = async (
  orderId: string,
  orderData: any,
  options: { replayCompleted?: boolean } = {},
) => {
  const jobId = `crm-create-${orderId}`;
  const existingJob = await crmQueue.getJob(jobId);
  if (existingJob) {
    if (await existingJob.isFailed()) await existingJob.retry();
    else if ((options.replayCompleted || orderData?.contractVersion === 1) && await existingJob.isCompleted()) await existingJob.remove();
    else return existingJob;
  }

  const originalSource = typeof orderData?.source === 'string' ? orderData.source : 'website';
  const normalizedOrderData = {
    ...orderData,
    externalOrderId: orderId,
    source: originalSource.startsWith('website') ? 'website' : originalSource,
    ...(originalSource !== 'website' ? { sourceDetail: originalSource } : {}),
  };

  const job = await crmQueue.add(
    {
      type: 'createOrder',
      data: {
        orderId,
        orderData: normalizedOrderData,
        reconciliationReplay: Boolean(options.replayCompleted),
      },
    },
    {
      jobId,
      attempts: orderData?.contractVersion === 1 ? 1 : 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 10000,
      removeOnFail: false,
    }
  );

  log.info(`📥 Заказ ${orderId} добавлен в очередь CRM`, { jobId: job.id });
  return job;
};

const stableSerialize = (value: any): string => {
  if (value === undefined) return '"__undefined__"';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const addUpdateToCRMQueue = async (orderId: string, crmOrderId: string, orderData: any) => {
  const normalizedOrderData = { ...orderData, externalOrderId: orderId };
  const fingerprint = crypto
    .createHash('sha256')
    .update(stableSerialize(normalizedOrderData))
    .digest('hex')
    .slice(0, 16);
  const jobId = `crm-update-${orderId}-${fingerprint}`;
  const existingJob = await crmQueue.getJob(jobId);
  if (existingJob) {
    if (await existingJob.isFailed()) await existingJob.retry();
    return existingJob;
  }

  const job = await crmQueue.add(
    {
      type: 'updateOrder',
      data: { orderId, crmOrderId, orderData: normalizedOrderData },
    },
    {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 10000,
      removeOnFail: false,
    }
  );

  log.info(`📥 Обновление заказа ${crmOrderId} добавлено в очередь CRM`, { jobId: job.id });
  return job;
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТИСТИКИ ОЧЕРЕДИ
// ============================================================
export const getCRMQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    crmQueue.getWaitingCount(),
    crmQueue.getActiveCount(),
    crmQueue.getCompletedCount(),
    crmQueue.getFailedCount(),
    crmQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

// ============================================================
// ПОВТОРНАЯ ОТПРАВКА НЕУДАВШИХСЯ ЗАКАЗОВ (ДЛЯ АДМИНОВ)
// ============================================================
export const retryFailedOrders = async () => {
  const failed = await crmQueue.getFailed();

  for (const job of failed) {
    await job.retry();
    log.info(`🔄 Повторная отправка задачи ${job.id}`);
  }

  return { retried: failed.length };
};

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
crmQueue.on('completed', (job) => {
  log.info(`✅ Задача ${job.id} выполнена`);
});

crmQueue.on('failed', (job, err) => {
  log.error(`❌ Задача ${job.id} провалилась`, { error: err.message });
});

crmQueue.on('stalled', (job) => {
  log.warn(`⚠️ Задача ${job.id} зависла`);
});

crmQueue.on('error', (error) => {
  log.error('CRM queue Redis error', { error: error.message });
});

export const closeCrmQueue = async (): Promise<void> => {
  await crmQueue.close();
};

export default crmQueue;
