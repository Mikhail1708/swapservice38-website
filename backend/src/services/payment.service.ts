// backend/src/services/payment.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import redis from '../config/redis';

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

    // ✅ ТЕСТОВЫЙ РЕЖИМ
    if (isTestMode) {
      console.log('⚠️ ЮKassa в тестовом режиме, возвращаем тестовый URL');
      
      const testPaymentId = `test_${Date.now()}`;
      
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId: testPaymentId },
      });
      
      // ✅ В ТЕСТОВОМ РЕЖИМЕ СРАЗУ ОТПРАВЛЯЕМ В CRM (ЧЕРЕЗ 2 СЕКУНДЫ)
      setTimeout(async () => {
        try {
          console.log('🔄 Тестовый режим: отправка заказа в CRM...');
          await handlePaymentSuccess(orderId);
        } catch (error) {
          console.error('❌ Ошибка тестовой отправки в CRM:', error);
        }
      }, 2000);
      
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
  // ✅ ПРОВЕРЯЕМ В REDIS, НЕ БЫЛИ ЛИ УЖЕ ОТПРАВЛЕНЫ УВЕДОМЛЕНИЯ
  const notifiedKey = `order:notified:${orderId}`;
  const alreadyNotified = await redis.get(notifiedKey);
  
  if (alreadyNotified) {
    console.log(`ℹ️ Уведомления уже отправлены для заказа ${orderId}, пропускаем`);
    return { success: true, orderId, status: 'paid', alreadyNotified: true };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Заказ ${orderId} не найден`);
  }

  console.log(`✅ Заказ ${orderId} оплачен!`);

  let crmResult = null;

  // ✅ 1. ОТПРАВЛЯЕМ ЗАКАЗ В CRM
  try {
    const phone = cleanPhone(order.guestPhone || '');
    
    if (!phone || phone.length < 10) {
      console.error('❌ Нет телефона для отправки в CRM! Используем заглушку');
    }

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

    console.log('📤 Отправка в CRM:');
    console.log('  URL:', `${process.env.CRM_API_URL || 'http://localhost:5000'}/api/sale-documents/public`);
    console.log('  Данные:', JSON.stringify(orderData, null, 2));

    const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
    const crmResponse = await axios.post(
      `${CRM_API_URL}/api/sale-documents/public`,
      orderData,
      { timeout: 15000 }
    );
    
    crmResult = crmResponse.data;
    console.log('✅ Заказ отправлен в CRM:', crmResult);
  } catch (crmError: any) {
    console.error('❌ Ошибка отправки в CRM:');
    console.error('  Message:', crmError.message);
    if (crmError.response) {
      console.error('  Статус:', crmError.response.status);
      console.error('  Ответ:', JSON.stringify(crmError.response.data, null, 2));
    }
    // ✅ НЕ ПРЕРЫВАЕМ ВЫПОЛНЕНИЕ — ПРОДОЛЖАЕМ
  }

  // ✅ 2. ОБНОВЛЯЕМ СТАТУС ЗАКАЗА
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      crmOrderId: crmResult?.orderId ? String(crmResult.orderId) : null,
      orderNumber: crmResult?.documentNumber || null,
    },
  });

  // ✅ 3. ОЧИЩАЕМ КОРЗИНУ
  if (order.userId) {
    await prisma.cart.update({
      where: { userId: order.userId },
      data: { items: [] },
    });
    console.log('🧹 Корзина очищена для пользователя:', order.userId);
  }

  // ✅ 4. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ (ТОЛЬКО ОДИН РАЗ)
  try {
    const { sendOrderConfirmationToCustomer, sendOrderNotificationToManager } = await import('./email.service');
    
    const emailData = {
      orderId: order.id,
      documentNumber: crmResult?.documentNumber || order.id.slice(0, 8),
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
    
    console.log('✅ Уведомления отправлены');

    // ✅ СОХРАНЯЕМ В REDIS, ЧТО УВЕДОМЛЕНИЯ ОТПРАВЛЕНЫ (на 7 дней)
    await redis.setex(notifiedKey, 7 * 24 * 60 * 60, 'true');
    console.log(`✅ Ключ ${notifiedKey} сохранён в Redis`);

  } catch (emailError) {
    console.error('❌ Ошибка отправки email:', emailError);
  }

  return { success: true, orderId, status: 'paid', crmResult };
};

// ============================================================
// ОБРАБОТКА WEBHOOK ОТ ЮKASSA
// ============================================================
export const handlePaymentWebhook = async (event: any) => {
  console.log('📥 Webhook от ЮKassa:', event.object?.id, event.object?.status);

  const payment = event.object;
  
  if (!payment || !payment.metadata) {
    throw new Error('Невалидный webhook');
  }

  const { orderId } = payment.metadata;
  const status = payment.status;

  // ===== УСПЕШНАЯ ОПЛАТА =====
  if (status === 'succeeded') {
    return await handlePaymentSuccess(orderId);
  }

  // ===== ОТМЕНА =====
  if (status === 'canceled') {
    console.log(`❌ Заказ ${orderId} отменён`);
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });
    return { success: true, orderId, status: 'cancelled' };
  }

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