// backend/src/services/payment.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { safeRedis } from '../config/redis';
import { 
  sendOrderConfirmationToCustomer, 
  sendOrderNotificationToManager 
} from './email.service';
import { addOrderToCRMQueue } from '../queues/crm.queue';
import { log } from '../config/logger';

const prisma = new PrismaClient();

// ✅ БЕРЁМ ИЗ .ENV
const YOO_KASSA_SHOP_ID = process.env.YOO_KASSA_SHOP_ID || '';
const YOO_KASSA_SECRET_KEY = process.env.YOO_KASSA_SECRET_KEY || '';
const YOO_KASSA_API_URL = 'https://api.yookassa.ru/v3';

// ✅ ПРОВЕРКА: ЕСЛИ КЛЮЧИ НЕ НАСТРОЕНЫ — ТЕСТОВЫЙ РЕЖИМ
const isTestMode = !YOO_KASSA_SHOP_ID || !YOO_KASSA_SECRET_KEY || YOO_KASSA_SECRET_KEY.startsWith('test_');

log.info(`💳 ЮKassa режим: ${isTestMode ? 'ТЕСТОВЫЙ' : 'БОЕВОЙ'}`);

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

// ============================================================
// СОЗДАНИЕ ПЛАТЕЖА
// ============================================================
export const createPayment = async (orderId: string, returnUrl: string) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.status === 'paid') {
      throw new Error('Заказ уже оплачен');
    }

    log.info('💳 Создание платежа', { orderId, total: order.total });

    // ✅ ТЕСТОВЫЙ РЕЖИМ
    if (isTestMode) {
      log.info('⚠️ ЮKassa в тестовом режиме');
      
      const testPaymentId = `test_${Date.now()}`;
      
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId: testPaymentId },
      });
      
      return {
        paymentId: testPaymentId,
        paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:3001'}/payment/success?orderId=${orderId}`,
        status: 'pending',
      };
    }

    // ===== БОЕВОЙ РЕЖИМ =====
    const auth = Buffer.from(`${YOO_KASSA_SHOP_ID}:${YOO_KASSA_SECRET_KEY}`).toString('base64');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Idempotence-Key': `${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
        value: order.total.toFixed(2),
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
        crmOrderId: order.crmOrderId || '',
        orderNumber: order.orderNumber || '',
      },
      receipt: {
        customer: {
          email: order.guestEmail || undefined,
          phone: order.guestPhone || undefined,
        },
        items: items,
      },
    };

    log.debug('📤 Отправка в ЮKassa', { paymentData });

    const response = await axios.post(
      `${YOO_KASSA_API_URL}/payments`,
      paymentData,
      { headers }
    );

    log.info('✅ Платёж создан', { paymentId: response.data.id });

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentId: response.data.id },
    });

    return {
      paymentId: response.data.id,
      paymentUrl: response.data.confirmation.confirmation_url,
      status: response.data.status,
    };
  } catch (error: any) {
    log.error('❌ Ошибка создания платежа', { 
      orderId, 
      error: error.response?.data || error.message 
    });
    throw new Error(error.response?.data?.description || 'Ошибка создания платежа');
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
      return { success: true, orderId, status: 'paid', alreadyProcessing: true };
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
      await safeRedis.del(lockKey);
      return { success: true, orderId, status: 'paid', alreadyProcessed: true };
    }
  } catch (error) {
    log.warn('⚠️ Ошибка проверки Redis', { error });
  }

  // ✅ ПОЛУЧАЕМ ЗАКАЗ
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  // ✅ ЕСЛИ УЖЕ ОПЛАЧЕН И ЕСТЬ crmOrderId — ПРОПУСКАЕМ
  if (order.status === 'paid' && order.crmOrderId) {
    log.info(`ℹ️ Заказ ${orderId} уже оплачен и отправлен в CRM, пропускаем`);
    await safeRedis.del(lockKey);
    return { success: true, orderId, status: 'paid', alreadyProcessed: true };
  }

  log.info(`✅ Заказ ${orderId} оплачен!`);

  // ✅ 1. ОТПРАВЛЯЕМ ЗАКАЗ В CRM ЧЕРЕЗ ОЧЕРЕДЬ
  if (!order.crmOrderId) {
    try {
      const phone = cleanPhone(order.guestPhone || '');
      
      const orderData = {
        items: (order.items as any[]).map((item: any) => ({
          productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
          quantity: item.quantity || 1,
          price: item.price || 0,
        })),
        client: {
          firstName: order.guestName || 'Клиент',
          lastName: '',
          phone: phone || '+79999999999',
          email: order.guestEmail || '',
          city: '',
          address: order.deliveryAddress || '',
        },
        deliveryMethod: order.deliveryMethod || 'pickup',
        deliveryAddress: order.deliveryAddress || '',
        comment: order.comment || '',
        source: 'website'
      };

      // ✅ ДОБАВЛЯЕМ В ОЧЕРЕДЬ, А НЕ ОТПРАВЛЯЕМ ПРЯМО
      await addOrderToCRMQueue(orderId, orderData);
      log.info(`✅ Заказ ${orderId} добавлен в очередь CRM`);
    } catch (error: any) {
      log.error(`❌ Ошибка добавления заказа ${orderId} в очередь`, { error: error.message });
      // Заказ уже помечен как paid, очередь попытается отправить позже
    }
  } else {
    log.info(`ℹ️ Заказ ${orderId} уже имеет crmOrderId: ${order.crmOrderId}, пропускаем отправку в CRM`);
  }

  // ✅ 2. ОБНОВЛЯЕМ СТАТУС ЗАКАЗА
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        updatedAt: new Date(),
      },
    });
    log.info(`✅ Статус заказа ${orderId} обновлён на "paid"`);
  } catch (error) {
    log.error(`❌ Ошибка обновления статуса заказа ${orderId}`, { error });
  }

  // ✅ 3. ОЧИЩАЕМ КОРЗИНУ
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

  // ✅ 4. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ
  try {
    const emailData = {
      orderId: order.id,
      documentNumber: order.orderNumber || order.id.slice(0, 8),
      customerName: order.guestName || 'Клиент',
      customerEmail: order.guestEmail || '',
      customerPhone: order.guestPhone || '',
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
    log.info(`✅ Уведомления отправлены для заказа ${orderId}`);
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
  log.info('📥 Webhook от ЮKassa', { paymentId: event.object?.id, status: event.object?.status });

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
    log.info(`❌ Webhook: заказ ${orderId} отменён`);
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
      log.info(`✅ Статус заказа ${orderId} обновлён на "cancelled"`);
    } catch (error) {
      log.error(`❌ Ошибка обновления статуса заказа ${orderId}`, { error });
    }
    return { success: true, orderId, status: 'cancelled' };
  }

  log.info(`ℹ️ Webhook: заказ ${orderId}, статус ${status} (не обрабатывается)`);
  return { success: true, orderId, status };
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ПЛАТЕЖА
// ============================================================
export const getPaymentStatus = async (paymentId: string) => {
  if (isTestMode || paymentId.startsWith('test_')) {
    log.debug('ℹ️ Тестовый платеж, возвращаем статус "pending"');
    return { status: 'pending' };
  }

  try {
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

// ============================================================
// ПРОВЕРКА ПОДПИСИ WEBHOOK
// ============================================================
export const verifyWebhookSignature = (body: string, signature: string | null): boolean => {
  if (!signature) return false;
  if (isTestMode) {
    log.debug('ℹ️ Тестовый режим: проверка подписи пропущена');
    return true;
  }
  
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', YOO_KASSA_SECRET_KEY)
      .update(body)
      .digest('base64');
    return hash === signature;
  } catch (error) {
    log.error('❌ Ошибка проверки подписи', { error });
    return false;
  }
};

// ============================================================
// ПРИНУДИТЕЛЬНАЯ ОТПРАВКА ЗАКАЗА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
export const resendOrderToCRM = async (orderId: string): Promise<any> => {
  log.info(`🔄 [resendOrderToCRM] Принудительная отправка заказа ${orderId} в CRM`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  try {
    const phone = cleanPhone(order.guestPhone || '');
    
    const orderData = {
      items: (order.items as any[]).map((item: any) => ({
        productId: typeof item.productId === 'string' ? parseInt(item.productId) : item.productId,
        quantity: item.quantity || 1,
        price: item.price || 0,
      })),
      client: {
        firstName: order.guestName || 'Клиент',
        lastName: '',
        phone: phone || '+79999999999',
        email: order.guestEmail || '',
        city: '',
        address: order.deliveryAddress || '',
      },
      deliveryMethod: order.deliveryMethod || 'pickup',
      deliveryAddress: order.deliveryAddress || '',
      comment: order.comment || '',
      source: 'website_resend'
    };

    log.info(`📤 Принудительная отправка заказа ${orderId} в CRM...`);

    const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
    const crmResponse = await axios.post(
      `${CRM_API_URL}/api/sale-documents/public`,
      orderData,
      { timeout: 15000 }
    );
    
    const crmResult = crmResponse.data;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        crmOrderId: crmResult?.orderId ? String(crmResult.orderId) : null,
        orderNumber: crmResult?.documentNumber || null,
        status: 'paid',
        updatedAt: new Date(),
      },
    });

    log.info(`✅ Заказ ${orderId} принудительно отправлен в CRM`, { 
      crmOrderId: crmResult?.orderId,
      documentNumber: crmResult?.documentNumber 
    });

    // Отправляем уведомления
    try {
      const emailData = {
        orderId: order.id,
        documentNumber: crmResult?.documentNumber || order.orderNumber || order.id.slice(0, 8),
        customerName: order.guestName || 'Клиент',
        customerEmail: order.guestEmail || '',
        customerPhone: order.guestPhone || '',
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
      log.info(`✅ Уведомления отправлены для заказа ${orderId}`);
    } catch (emailError) {
      log.error(`❌ Ошибка отправки email для заказа ${orderId}`, { error: emailError });
    }

    return {
      success: true,
      orderId,
      crmOrderId: crmResult?.orderId,
      documentNumber: crmResult?.documentNumber,
    };

  } catch (error: any) {
    log.error(`❌ Ошибка принудительной отправки заказа ${orderId} в CRM`, { 
      error: error.message,
      response: error.response?.data 
    });
    throw error;
  }
};