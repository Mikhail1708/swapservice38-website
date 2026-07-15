// backend/src/queues/crm.queue.ts
import Queue from 'bull';
import axios from 'axios';
import { log } from '../config/logger';
import { PrismaClient } from '@prisma/client';

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
      await markOrderAsFailed(data);
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
        'X-API-Key': process.env.INTERNAL_API_KEY || 'swapservice38_internal_secret',
      },
    }
  );

  const crmResult = response.data;

  // Обновляем заказ в БД
  await prisma.order.update({
    where: { id: orderId },
    data: {
      crmOrderId: crmResult.orderId ? String(crmResult.orderId) : null,
      orderNumber: crmResult.documentNumber || null,
      status: 'paid',
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
    `${CRM_API_URL}/api/sale-documents/${crmOrderId}/full`,
    orderData,
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.INTERNAL_API_KEY || 'swapservice38_internal_secret',
      },
    }
  );

  log.info(`✅ Заказ ${crmOrderId} обновлён в CRM`);
  return response.data;
};

// ============================================================
// МАРКИРОВКА ЗАКАЗА КАК FAILED
// ============================================================
const markOrderAsFailed = async (data: any) => {
  try {
    if (data.orderId) {
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
  const job = await crmQueue.add(
    {
      type: 'createOrder',
      data: { orderId, orderData },
    },
    {
      attempts: 5, // 5 попыток
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 сек, 10 сек, 20 сек, 40 сек, 80 сек
      },
      removeOnComplete: true,
      removeOnFail: false, // сохраняем для анализа
    }
  );

  log.info(`📥 Заказ ${orderId} добавлен в очередь CRM`, { jobId: job.id });
  return job;
};

export const addUpdateToCRMQueue = async (crmOrderId: string, orderData: any) => {
  const job = await crmQueue.add(
    {
      type: 'updateOrder',
      data: { crmOrderId, orderData },
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
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