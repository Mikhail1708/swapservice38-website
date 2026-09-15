import Queue from 'bull';
import nodemailer from 'nodemailer';
import redis from '../config/redis';
import { Prisma } from '@prisma/client';
import { EmailPayload, persistEmailEvent } from './emailOutbox.service';
import { createEmailJobData, EmailJobData } from './emailAttachments';
import {
  OrderEmailData,
  OrderCreatedEmailData,
  orderConfirmationCustomerTemplate,
  orderCreatedCustomerTemplate,
  orderNotificationManagerTemplate,
  orderStatusCustomerTemplate,
  passwordChangeEmailTemplate,
  passwordChangedEmailTemplate,
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from './emailTemplates';

const formatPhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
  }
  if (cleaned.length === 10) {
    return `+7 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
  }
  return phone;
};

let emailQueue: Queue.Queue;
let queueAvailable = true;

try {
  emailQueue = new Queue('email queue', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    },
  });
  console.log('✅ Email очередь инициализирована');
} catch {
  queueAvailable = false;
  console.warn('⚠️ Очередь не инициализирована, email будут отправляться синхронно');
  emailQueue = {
    add: async (data: any) => {
      await sendEmailSync(data);
      return { id: `fallback-${Date.now()}` };
    },
    process: () => {},
    on: () => emailQueue,
  } as any;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error('❌ Ошибка подключения к почтовому серверу:', { errorName: error.name });
  else console.log('✅ Почтовый сервер настроен успешно');
});

const sendEmailSync = async (data: EmailJobData) => transporter.sendMail({
  from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
  ...data,
});

emailQueue.process(async (job) => {
  try {
    return await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
      ...job.data,
    });
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', { errorName: error instanceof Error ? error.name : 'unknown' });
    throw error;
  }
});

emailQueue.on('failed', async (job) => {
  const attempts = Number(job.opts.attempts || 1);
  if (job.attemptsMade >= attempts && typeof job.id === 'string' && job.id.startsWith('order:')) {
    await redis.del(job.id).catch(() => undefined);
    console.warn(`⚠️ Уведомление ${job.id} исчерпало попытки; защита от дублей снята для повторной отправки`);
  }
});

export const sendEmail = (to: string, subject: string, html: string, jobId?: string, text?: string) => emailQueue.add(
  createEmailJobData(to, subject, html, text),
  {
    ...(jobId ? { jobId } : {}),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
);

// Outbox delivery must reach Bull, never silently fall back to synchronous SMTP.
// Retained completed jobs deduplicate a crash after enqueue but before DB ACK.
export const enqueueOutboxEmail = (payload: EmailPayload, jobId: string) => {
  if (!queueAvailable) throw new Error('Email queue unavailable');
  return emailQueue.add(createEmailJobData(payload.to, payload.subject, payload.html, payload.text), {
    jobId, attempts: 5, backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: false, removeOnFail: false,
  });
};

const enqueueNotificationOnce = async (
  notificationKey: string,
  to: string,
  subject: string,
  html: string,
  text?: string,
  tx?: Prisma.TransactionClient,
  aggregateId?: string,
  eventType?: string,
): Promise<void> => {
  if (tx) {
    await persistEmailEvent(tx, {
      eventType: eventType!, aggregateId: aggregateId!, deduplicationKey: notificationKey,
      payload: { to, subject, html, ...(text ? { text } : {}) },
    });
    return;
  }
  const isNew = await redis.setnx(notificationKey, 'true');
  if (!isNew) {
    console.log(`ℹ️ Уведомление ${notificationKey} уже поставлено в очередь, пропускаем`);
    return;
  }

  try {
    await redis.expire(notificationKey, 7 * 24 * 60 * 60);
    await sendEmail(to, subject, html, notificationKey, text);
  } catch (error) {
    await redis.del(notificationKey).catch(() => undefined);
    throw error;
  }
};

export const sendVerificationEmail = (email: string, code: string, customerName?: string, verificationToken?: string) => {
  const template = verificationEmailTemplate(code, customerName, verificationToken);
  return sendEmail(email, template.subject, template.html, undefined, template.text);
};

export const sendPasswordResetEmail = (email: string, code: string) => {
  const template = passwordResetEmailTemplate(code);
  return sendEmail(email, template.subject, template.html, undefined, template.text);
};

export const sendPasswordChangeEmail = (email: string, code: string) => {
  const template = passwordChangeEmailTemplate(code);
  return sendEmail(email, template.subject, template.html, undefined, template.text);
};

export const sendPasswordChangedEmail = (email: string) => {
  const template = passwordChangedEmailTemplate();
  return sendEmail(email, template.subject, template.html, undefined, template.text);
};

export const sendOrderConfirmationToCustomer = async (data: OrderEmailData, tx?: Prisma.TransactionClient) => {
  if (!data.customerEmail) {
    console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, пропускаем`);
    return;
  }
  const template = orderConfirmationCustomerTemplate(data, formatPhone(data.customerPhone));
  await enqueueNotificationOnce(
    `order:notified:customer:${data.orderId}`,
    data.customerEmail,
    template.subject,
    template.html,
    template.text,
    tx, data.orderId, 'payment_succeeded',
  );
};

export const sendOrderNotificationToManager = async (data: OrderEmailData, tx?: Prisma.TransactionClient, eventType = 'order_created') => {
  const template = orderNotificationManagerTemplate(data, formatPhone(data.customerPhone));
  await enqueueNotificationOnce(
    tx ? `${eventType}:${data.orderId}:manager` : `order:notified:manager:${data.orderId}`,
    process.env.MANAGER_EMAIL || 'swapservice38@yandex.ru',
    template.subject,
    template.html,
    template.text,
    tx, data.orderId, eventType,
  );
};

export const sendOrderCreatedToCustomer = async (data: OrderCreatedEmailData & {
  customerEmail: string;
}, tx?: Prisma.TransactionClient) => {
  if (!data.customerEmail) {
    console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, письмо о формировании пропущено`);
    return;
  }
  const template = orderCreatedCustomerTemplate(data);
  await enqueueNotificationOnce(
    `order:created:customer:${data.orderId}`,
    data.customerEmail,
    template.subject,
    template.html,
    template.text,
    tx, data.orderId, 'order_created',
  );
};

const orderStatusLabels: Record<string, string> = {
  confirmed: 'Подтверждён',
  assembling: 'Собирается',
  shipped: 'Отправлен',
  cancelled: 'Отменён',
};

export const sendOrderStatusUpdateToCustomer = async (data: {
  orderId: string;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  version: number;
}, tx?: Prisma.TransactionClient) => {
  if (!data.customerEmail) {
    console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, уведомление о статусе пропущено`);
    return;
  }
  const statusLabel = orderStatusLabels[data.status];
  if (!statusLabel) {
    console.warn(`⚠️ Неизвестный статус ${data.status}, письмо не отправлено`);
    return;
  }
  const template = orderStatusCustomerTemplate(data, statusLabel);
  await enqueueNotificationOnce(
    `order:status:${data.orderId}:${data.status}:${data.version}`,
    data.customerEmail,
    template.subject,
    template.html,
    template.text,
    tx, data.orderId, 'order_status',
  );
};
