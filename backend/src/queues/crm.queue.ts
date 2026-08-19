// backend/src/queues/crm.queue.ts
import Queue from 'bull';
import axios from 'axios';
import { log } from '../config/logger';
import { PrismaClient } from '@prisma/client';
import { getInternalApiKey } from '../utils/internalApiKey';
import crypto from 'crypto';

const prisma = new PrismaClient();
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

// ============================================================
// СОЗДАНИЕ ОЧЕРЕДИ
// ============================================================
const crmQueue = new Queue('crm queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// ============================================================
// ТИПЫ ЗАДАЧ
// ============================================================
interface CreateOrderJob {
  type: 'createOrder';
  data: {
    orderId: string;
    orderData: any;
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
      await markOrderAsFailed(type, data);
    }

    throw error;
  }
});

// ============================================================
// ОБРАБОТЧИК: СОЗДАНИЕ ЗАКАЗА
// ============================================================
const processCreateOrder = async (data: any) => {
  const { orderId, orderData } = data;

  log.info(`📤 Отправка заказа ${orderId} в CRM (попытка)`);

  const response = await axios.post(
    `${CRM_API_URL}/api/sale-documents/public`,
    orderData,
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getInternalApiKey(),
      },
    }
  );

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
  await prisma.order.update({
    where: { id: orderId },
    data: {
      crmOrderId: crmResult.orderId ? String(crmResult.orderId) : null,
      orderNumber: crmResult.documentNumber || null,
      // CRM creates website orders as confirmed. Persist its initial state and
      // version so subsequent webhooks continue from the same source of truth.
      status: syncedStatus,
      crmStatusVersion: syncedVersion,
    },
  });

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
const markOrderAsFailed = async (type: CRMJob['type'], data: any) => {
  try {
    if (type === 'createOrder' && data.orderId) {
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: 'crm_failed',
          comment: `Ошибка отправки в CRM: все попытки исчерпаны`,
        },
      });
      log.error(`❌ Заказ ${data.orderId} помечен как CRM_FAILED`);
    }
  } catch (error) {
    log.error('❌ Ошибка маркировки заказа как failed', { error });
  }
};

// ============================================================
// ФУНКЦИИ ДЛЯ ДОБАВЛЕНИЯ ЗАДАЧ В ОЧЕРЕДЬ
// ============================================================
export const addOrderToCRMQueue = async (orderId: string, orderData: any) => {
  const jobId = `crm-create-${orderId}`;
  const existingJob = await crmQueue.getJob(jobId);
  if (existingJob) {
    if (await existingJob.isFailed()) await existingJob.retry();
    return existingJob;
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
      data: { orderId, orderData: normalizedOrderData },
    },
    {
      jobId,
      attempts: 5,
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

export default crmQueue;
