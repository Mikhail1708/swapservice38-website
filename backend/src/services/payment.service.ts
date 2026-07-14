// backend/src/services/payment.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { safeRedis } from '../config/redis';
import { 
  sendOrderConfirmationToCustomer, 
  sendOrderNotificationToManager 
} from './email.service';

const prisma = new PrismaClient();

// ✅ БЕРЁМ ИЗ .ENV
const YOO_KASSA_SHOP_ID = process.env.YOO_KASSA_SHOP_ID || '';
const YOO_KASSA_SECRET_KEY = process.env.YOO_KASSA_SECRET_KEY || '';
const YOO_KASSA_API_URL = 'https://api.yookassa.ru/v3';

// ✅ ПРОВЕРКА: ЕСЛИ КЛЮЧИ НЕ НАСТРОЕНЫ — ТЕСТОВЫЙ РЕЖИМ
const isTestMode = !YOO_KASSA_SHOP_ID || !YOO_KASSA_SECRET_KEY || YOO_KASSA_SECRET_KEY.startsWith('test_');

console.log(`💳 ЮKassa режим: ${isTestMode ? 'ТЕСТОВЫЙ' : 'БОЕВОЙ'}`);

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

    console.log('💳 Создание платежа для заказа:', orderId);
    console.log('📦 Сумма:', order.total);
    console.log(`🔧 Режим: ${isTestMode ? 'ТЕСТОВЫЙ' : 'БОЕВОЙ'}`);

    // ✅ ТЕСТОВЫЙ РЕЖИМ — ТОЛЬКО СОЗДАЁМ ПЛАТЁЖ, НЕ ОТПРАВЛЯЕМ В CRM
    if (isTestMode) {
      console.log('⚠️ ЮKassa в тестовом режиме, возвращаем тестовый URL');
      
      const testPaymentId = `test_${Date.now()}`;
      
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId: testPaymentId },
      });
      
      // ✅ НЕ ВЫЗЫВАЕМ handlePaymentSuccess ЗДЕСЬ!
      // Заказ будет отправлен в CRM ТОЛЬКО со страницы успеха
      
      return {
        paymentId: testPaymentId,
        paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:3001'}/payment/success?orderId=${orderId}`,
        status: 'pending',
      };
    }

    // ===== БОЕВОЙ РЕЖИМ — РЕАЛЬНАЯ ЮKASSA =====
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

    console.log('📤 Отправка в ЮKassa:', JSON.stringify(paymentData, null, 2));

    const response = await axios.post(
      `${YOO_KASSA_API_URL}/payments`,
      paymentData,
      { headers }
    );

    console.log('✅ Платёж создан:', response.data.id);

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
    console.error('❌ Ошибка создания платежа:', error.response?.data || error.message);
    throw new Error(error.response?.data?.description || 'Ошибка создания платежа');
  }
};

// ============================================================
// ОБРАБОТКА УСПЕШНОЙ ОПЛАТЫ → ОТПРАВКА В CRM
// ============================================================
export const handlePaymentSuccess = async (orderId: string) => {
  console.log(`🔄 [handlePaymentSuccess] Начало обработки заказа ${orderId}`);
  
  // ✅ БЛОКИРУЕМ ОБРАБОТКУ — СОХРАНЯЕМ В REDIS СРАЗУ
  const processedKey = `order:processed:${orderId}`;
  const lockKey = `order:processing:${orderId}`;
  
  // ✅ ПРОВЕРЯЕМ, НЕ ОБРАБАТЫВАЕТСЯ ЛИ УЖЕ ЗАКАЗ
  try {
    const processing = await safeRedis.get(lockKey);
    if (processing) {
      console.log(`ℹ️ Заказ ${orderId} уже обрабатывается, пропускаем`);
      return { success: true, orderId, status: 'paid', alreadyProcessing: true };
    }
    
    // ✅ УСТАНАВЛИВАЕМ БЛОКИРОВКУ НА 30 СЕКУНД
    await safeRedis.setex(lockKey, 30, 'true');
    console.log(`🔒 Заказ ${orderId} заблокирован для обработки`);
  } catch (error) {
    console.warn('⚠️ Ошибка блокировки Redis:', error);
  }
  
  // ✅ ПРОВЕРЯЕМ, НЕ БЫЛ ЛИ УЖЕ ОБРАБОТАН ЗАКАЗ
  try {
    const cached = await safeRedis.get(processedKey);
    if (cached) {
      console.log(`ℹ️ Заказ ${orderId} уже был обработан, пропускаем`);
      // ✅ СНИМАЕМ БЛОКИРОВКУ
      await safeRedis.del(lockKey);
      return { success: true, orderId, status: 'paid', alreadyProcessed: true };
    }
  } catch (error) {
    console.warn('⚠️ Ошибка проверки Redis:', error);
  }

  // ✅ ПОЛУЧАЕМ ЗАКАЗ ИЗ БД
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    console.error(`❌ Заказ ${orderId} не найден`);
    // ✅ СНИМАЕМ БЛОКИРОВКУ
    await safeRedis.del(lockKey);
    throw new Error(`Заказ ${orderId} не найден`);
  }

  console.log(`📦 Заказ ${orderId} найден:`, {
    status: order.status,
    crmOrderId: order.crmOrderId,
    orderNumber: order.orderNumber,
    total: order.total,
    itemsCount: (order.items as any[])?.length || 0,
  });

  // ✅ ЕСЛИ УЖЕ ОПЛАЧЕН И ЕСТЬ crmOrderId — ПРОПУСКАЕМ
  if (order.status === 'paid' && order.crmOrderId) {
    console.log(`ℹ️ Заказ ${orderId} уже оплачен и отправлен в CRM, пропускаем`);
    await safeRedis.del(lockKey);
    return { success: true, orderId, status: 'paid', alreadyProcessed: true };
  }

  console.log(`✅ Заказ ${orderId} оплачен!`);

  let crmResult = null;
  let crmError = null;

  // ✅ 1. ОТПРАВЛЯЕМ ЗАКАЗ В CRM (ТОЛЬКО ЕСЛИ НЕТ crmOrderId)
  if (order.crmOrderId) {
    console.log(`ℹ️ Заказ ${orderId} уже имеет crmOrderId: ${order.crmOrderId}, пропускаем отправку в CRM`);
  } else {
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

      console.log(`📤 Отправка заказа ${orderId} в CRM...`);
      console.log('  URL:', `${process.env.CRM_API_URL || 'http://localhost:5000'}/api/sale-documents/public`);
      console.log('  Данные:', JSON.stringify(orderData, null, 2));

      const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
      const crmResponse = await axios.post(
        `${CRM_API_URL}/api/sale-documents/public`,
        orderData,
        { timeout: 15000 }
      );
      
      crmResult = crmResponse.data;
      console.log(`✅ Заказ ${orderId} отправлен в CRM:`, crmResult);
    } catch (error: any) {
      crmError = error;
      console.error(`❌ Ошибка отправки заказа ${orderId} в CRM:`);
      console.error('  Message:', error.message);
      if (error.response) {
        console.error('  Статус:', error.response.status);
        console.error('  Ответ:', JSON.stringify(error.response.data, null, 2));
      }
      // ✅ НЕ ПРЕРЫВАЕМ ВЫПОЛНЕНИЕ — заказ всё равно помечаем как оплаченный
    }
  }

  // ✅ 2. ОБНОВЛЯЕМ СТАТУС ЗАКАЗА
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        crmOrderId: crmResult?.orderId ? String(crmResult.orderId) : order.crmOrderId,
        orderNumber: crmResult?.documentNumber || order.orderNumber,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Статус заказа ${orderId} обновлён на "paid"`);
  } catch (error) {
    console.error(`❌ Ошибка обновления статуса заказа ${orderId}:`, error);
  }

  // ✅ 3. ОЧИЩАЕМ КОРЗИНУ
  if (order.userId) {
    try {
      await prisma.cart.update({
        where: { userId: order.userId },
        data: { items: [] },
      });
      console.log(`🧹 Корзина очищена для пользователя: ${order.userId}`);
    } catch (error) {
      console.warn(`⚠️ Не удалось очистить корзину для ${order.userId}:`, error);
    }
  }

  // ✅ 4. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ (ТОЛЬКО ЕСЛИ ЗАКАЗ УСПЕШНО ОТПРАВЛЕН В CRM)
  if (crmResult && !crmError) {
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

      // ✅ ОТПРАВЛЯЕМ ОБА ПИСЬМА
      await sendOrderConfirmationToCustomer(emailData);
      await sendOrderNotificationToManager(emailData);
      
      console.log(`✅ Уведомления отправлены для заказа ${orderId}`);
    } catch (emailError) {
      console.error(`❌ Ошибка отправки email для заказа ${orderId}:`, emailError);
      // НЕ ПРЕРЫВАЕМ ВЫПОЛНЕНИЕ
    }
  } else if (crmError) {
    console.warn(`⚠️ Уведомления НЕ отправлены для заказа ${orderId}, т.к. заказ не попал в CRM`);
    // Отправляем уведомление менеджеру о проблеме
    try {
      await sendOrderNotificationToManager({
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
      });
      console.log(`⚠️ Отправлено уведомление менеджеру о проблеме с заказом ${orderId}`);
    } catch (emailError) {
      console.error(`❌ Ошибка отправки уведомления о проблеме для заказа ${orderId}:`, emailError);
    }
  }

  // ✅ 5. СОХРАНЯЕМ В REDIS, ЧТО ЗАКАЗ ОБРАБОТАН, И СНИМАЕМ БЛОКИРОВКУ
  try {
    await safeRedis.setex(processedKey, 7 * 24 * 60 * 60, 'true');
    await safeRedis.del(lockKey);
    console.log(`✅ Ключи сохранены в Redis, блокировка снята`);
  } catch (error) {
    console.warn('⚠️ Не удалось сохранить в Redis:', error);
  }

  console.log(`✅ [handlePaymentSuccess] Заказ ${orderId} успешно обработан`);
  return { 
    success: true, 
    orderId, 
    status: 'paid', 
    crmResult,
    crmError: crmError ? crmError.message : null,
  };
};

// ============================================================
// ОБРАБОТКА WEBHOOK ОТ ЮKASSA
// ============================================================
export const handlePaymentWebhook = async (event: any) => {
  console.log('📥 Webhook от ЮKassa:', event.object?.id, event.object?.status);

  const payment = event.object;
  
  if (!payment || !payment.metadata) {
    console.error('❌ Невалидный webhook: нет metadata');
    throw new Error('Невалидный webhook');
  }

  const { orderId } = payment.metadata;
  const status = payment.status;

  console.log(`📦 Webhook: orderId=${orderId}, status=${status}`);

  if (!orderId) {
    console.error('❌ Webhook: нет orderId в metadata');
    throw new Error('Нет orderId в metadata');
  }

  // ===== УСПЕШНАЯ ОПЛАТА =====
  if (status === 'succeeded') {
    console.log(`✅ Webhook: оплата заказа ${orderId} успешна`);
    return await handlePaymentSuccess(orderId);
  }

  // ===== ОТМЕНА =====
  if (status === 'canceled') {
    console.log(`❌ Webhook: заказ ${orderId} отменён`);
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
      console.log(`✅ Статус заказа ${orderId} обновлён на "cancelled"`);
    } catch (error) {
      console.error(`❌ Ошибка обновления статуса заказа ${orderId}:`, error);
    }
    return { success: true, orderId, status: 'cancelled' };
  }

  // ===== ДРУГИЕ СТАТУСЫ =====
  console.log(`ℹ️ Webhook: заказ ${orderId}, статус ${status} (не обрабатывается)`);
  return { success: true, orderId, status };
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ПЛАТЕЖА
// ============================================================
export const getPaymentStatus = async (paymentId: string) => {
  if (isTestMode || paymentId.startsWith('test_')) {
    console.log('ℹ️ Тестовый платеж, возвращаем статус "pending"');
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
    console.error('❌ Ошибка получения статуса платежа:', error.message);
    throw new Error('Ошибка получения статуса платежа');
  }
};

// ============================================================
// ПРОВЕРКА ПОДПИСИ WEBHOOK
// ============================================================
export const verifyWebhookSignature = (body: string, signature: string | null): boolean => {
  if (!signature) return false;
  if (isTestMode) {
    console.log('ℹ️ Тестовый режим: проверка подписи пропущена');
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
    console.error('❌ Ошибка проверки подписи:', error);
    return false;
  }
};

// ============================================================
// ФУНКЦИЯ ДЛЯ ПРИНУДИТЕЛЬНОЙ ОТПРАВКИ ЗАКАЗА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
export const resendOrderToCRM = async (orderId: string): Promise<any> => {
  console.log(`🔄 [resendOrderToCRM] Принудительная отправка заказа ${orderId} в CRM`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Заказ ${orderId} не найден`);
  }

  if (order.crmOrderId) {
    throw new Error(`Заказ ${orderId} уже отправлен в CRM (crmOrderId: ${order.crmOrderId})`);
  }

  if (order.status !== 'paid') {
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

    console.log(`📤 Принудительная отправка заказа ${orderId} в CRM...`);

    const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
    const crmResponse = await axios.post(
      `${CRM_API_URL}/api/sale-documents/public`,
      orderData,
      { timeout: 15000 }
    );
    
    const crmResult = crmResponse.data;

    // Обновляем заказ
    await prisma.order.update({
      where: { id: orderId },
      data: {
        crmOrderId: crmResult?.orderId ? String(crmResult.orderId) : null,
        orderNumber: crmResult?.documentNumber || null,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Заказ ${orderId} принудительно отправлен в CRM:`, crmResult);

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
      console.log(`✅ Уведомления отправлены для заказа ${orderId}`);
    } catch (emailError) {
      console.error(`❌ Ошибка отправки email для заказа ${orderId}:`, emailError);
    }

    return {
      success: true,
      orderId,
      crmOrderId: crmResult?.orderId,
      documentNumber: crmResult?.documentNumber,
    };

  } catch (error: any) {
    console.error(`❌ Ошибка принудительной отправки заказа ${orderId} в CRM:`, error.message);
    if (error.response) {
      console.error('  Статус:', error.response.status);
      console.error('  Ответ:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};