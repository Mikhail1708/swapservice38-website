"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderStatusUpdateToCustomer = exports.sendOrderCreatedToCustomer = exports.sendOrderNotificationToManager = exports.sendOrderConfirmationToCustomer = exports.sendPasswordChangedEmail = exports.sendPasswordChangeEmail = exports.sendPasswordResetEmail = exports.sendVerificationEmail = exports.cleanupCompletedEmails = exports.enqueueOutboxEmail = exports.sendEmail = void 0;
const bull_1 = __importDefault(require("bull"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const redis_1 = __importDefault(require("../config/redis"));
const emailQueuePolicy_1 = require("./emailQueuePolicy");
const emailOutbox_service_1 = require("./emailOutbox.service");
const emailAttachments_1 = require("./emailAttachments");
const invoiceEmailAttachment_service_1 = require("./invoiceEmailAttachment.service");
const emailTemplates_1 = require("./emailTemplates");
const formatPhone = (phone) => {
    if (!phone)
        return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('7')) {
        return `+7 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
    }
    if (cleaned.length === 10) {
        return `+7 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    return phone;
};
let emailQueue;
let queueAvailable = true;
try {
    emailQueue = new bull_1.default('email queue', {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            connectTimeout: 5000,
            password: process.env.REDIS_PASSWORD || undefined,
        },
    });
    console.log('✅ Email очередь инициализирована');
}
catch {
    queueAvailable = false;
    console.warn('⚠️ Очередь не инициализирована, email будут отправляться синхронно');
    emailQueue = {
        add: async (data) => {
            await sendEmailSync(data);
            return { id: `fallback-${Date.now()}` };
        },
        process: () => { },
        on: () => emailQueue,
    };
}
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
transporter.verify((error) => {
    if (error)
        console.error('❌ Ошибка подключения к почтовому серверу:', (0, invoiceEmailAttachment_service_1.emailErrorDetails)(error));
    else
        console.log('✅ Почтовый сервер настроен успешно');
});
const sendEmailSync = async (data) => transporter.sendMail({
    from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
    ...await (0, invoiceEmailAttachment_service_1.resolveEmailAttachments)(data),
});
emailQueue.process(async (job) => {
    try {
        await (0, emailQueuePolicy_1.claimSmtpAttempt)(emailQueue, job);
        return await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
            ...await (0, invoiceEmailAttachment_service_1.resolveEmailAttachments)(job.data, job.id),
        });
    }
    catch (error) {
        console.error('❌ Ошибка отправки письма:', (0, invoiceEmailAttachment_service_1.emailErrorDetails)(error));
        throw error;
    }
});
emailQueue.on('failed', async (job) => {
    const attempts = Number(job.opts.attempts || 1);
    if (job.attemptsMade >= attempts && typeof job.id === 'string' && job.id.startsWith('order:')) {
        await redis_1.default.del(job.id).catch(() => undefined);
        console.warn(`⚠️ Уведомление ${job.id} исчерпало попытки; защита от дублей снята для повторной отправки`);
    }
});
const sendEmail = (to, subject, html, jobId, text) => emailQueue.add((0, emailAttachments_1.createEmailJobData)(to, subject, html, text), {
    ...(jobId ? { jobId } : {}),
    attempts: emailQueuePolicy_1.EMAIL_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5000 },
});
exports.sendEmail = sendEmail;
// Outbox delivery must reach Bull, never silently fall back to synchronous SMTP.
// Retained completed jobs deduplicate a crash after enqueue but before DB ACK.
const enqueueOutboxEmail = (payload, jobId) => {
    if (!queueAvailable)
        throw new Error('Email queue unavailable');
    return emailQueue.add({ ...(0, emailAttachments_1.createEmailJobData)(payload.to, payload.subject, payload.html, payload.text),
        ...(payload.invoiceAttachment ? { invoiceAttachment: payload.invoiceAttachment } : {}) }, {
        jobId, attempts: emailQueuePolicy_1.EMAIL_OUTBOX_MAX_ATTEMPTS, backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false, removeOnFail: false,
    });
};
exports.enqueueOutboxEmail = enqueueOutboxEmail;
exports.cleanupCompletedEmails = (0, emailQueuePolicy_1.createEmailCleanup)(emailQueue, emailOutbox_service_1.emailOutboxPrisma);
const enqueueNotificationOnce = async (notificationKey, to, subject, html, text, tx, aggregateId, eventType) => {
    if (tx) {
        await (0, emailOutbox_service_1.persistEmailEvent)(tx, {
            eventType: eventType, aggregateId: aggregateId, deduplicationKey: notificationKey,
            payload: { to, subject, html, ...(text ? { text } : {}) },
        });
        return;
    }
    const isNew = await redis_1.default.setnx(notificationKey, 'true');
    if (!isNew) {
        console.log(`ℹ️ Уведомление ${notificationKey} уже поставлено в очередь, пропускаем`);
        return;
    }
    try {
        await redis_1.default.expire(notificationKey, 7 * 24 * 60 * 60);
        await (0, exports.sendEmail)(to, subject, html, notificationKey, text);
    }
    catch (error) {
        await redis_1.default.del(notificationKey).catch(() => undefined);
        throw error;
    }
};
const sendVerificationEmail = (email, code, customerName, verificationToken) => {
    const template = (0, emailTemplates_1.verificationEmailTemplate)(code, customerName, verificationToken);
    return (0, exports.sendEmail)(email, template.subject, template.html, undefined, template.text);
};
exports.sendVerificationEmail = sendVerificationEmail;
const sendPasswordResetEmail = (email, code) => {
    const template = (0, emailTemplates_1.passwordResetEmailTemplate)(code);
    return (0, exports.sendEmail)(email, template.subject, template.html, undefined, template.text);
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendPasswordChangeEmail = (email, code) => {
    const template = (0, emailTemplates_1.passwordChangeEmailTemplate)(code);
    return (0, exports.sendEmail)(email, template.subject, template.html, undefined, template.text);
};
exports.sendPasswordChangeEmail = sendPasswordChangeEmail;
const sendPasswordChangedEmail = (email) => {
    const template = (0, emailTemplates_1.passwordChangedEmailTemplate)();
    return (0, exports.sendEmail)(email, template.subject, template.html, undefined, template.text);
};
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
const sendOrderConfirmationToCustomer = async (data, tx) => {
    if (!data.customerEmail) {
        console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, пропускаем`);
        return;
    }
    const template = (0, emailTemplates_1.orderConfirmationCustomerTemplate)(data, formatPhone(data.customerPhone));
    await enqueueNotificationOnce(`order:notified:customer:${data.orderId}`, data.customerEmail, template.subject, template.html, template.text, tx, data.orderId, 'payment_succeeded');
};
exports.sendOrderConfirmationToCustomer = sendOrderConfirmationToCustomer;
const sendOrderNotificationToManager = async (data, tx, eventType = 'order_created') => {
    const template = (0, emailTemplates_1.orderNotificationManagerTemplate)(data, formatPhone(data.customerPhone));
    await enqueueNotificationOnce(tx ? `${eventType}:${data.orderId}:manager` : `order:notified:manager:${data.orderId}`, process.env.MANAGER_EMAIL || 'swapservice38@yandex.ru', template.subject, template.html, template.text, tx, data.orderId, eventType);
};
exports.sendOrderNotificationToManager = sendOrderNotificationToManager;
const sendOrderCreatedToCustomer = async (data, tx) => {
    if (!data.customerEmail) {
        console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, письмо о формировании пропущено`);
        return;
    }
    const template = (0, emailTemplates_1.orderCreatedCustomerTemplate)(data);
    await enqueueNotificationOnce(`order:created:customer:${data.orderId}`, data.customerEmail, template.subject, template.html, template.text, tx, data.orderId, 'order_created');
};
exports.sendOrderCreatedToCustomer = sendOrderCreatedToCustomer;
const orderStatusLabels = {
    confirmed: 'Подтверждён',
    assembling: 'Собирается',
    shipped: 'Отправлен',
    cancelled: 'Отменён',
};
const sendOrderStatusUpdateToCustomer = async (data, tx) => {
    if (!data.customerEmail) {
        console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, уведомление о статусе пропущено`);
        return;
    }
    const statusLabel = orderStatusLabels[data.status];
    if (!statusLabel) {
        console.warn(`⚠️ Неизвестный статус ${data.status}, письмо не отправлено`);
        return;
    }
    const template = (0, emailTemplates_1.orderStatusCustomerTemplate)(data, statusLabel);
    await enqueueNotificationOnce(`order:status:${data.orderId}:${data.status}:${data.version}`, data.customerEmail, template.subject, template.html, template.text, tx, data.orderId, 'order_status');
};
exports.sendOrderStatusUpdateToCustomer = sendOrderStatusUpdateToCustomer;
//# sourceMappingURL=email.service.js.map