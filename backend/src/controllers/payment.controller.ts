// backend/src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  createPayment, 
  handlePaymentSuccess, 
  handlePaymentWebhook, 
  getPaymentStatus,
  resendOrderToCRM,
  completeMockPayment,
  getPaymentProvider,
} from '../services/payment.service';
import { CheckoutInventoryError } from '../services/checkoutInventory.service';
import { PaymentPreparationError } from '../services/paymentAttempt.service';
import { lockPaymentWorkflowOrder } from '../services/paymentWorkflowLock.service';

const prisma = new PrismaClient();

const matchesDurablePaymentAttempt = (order: any, payment: any, amountMinor: number): boolean => {
  const attempt = order.paymentAttempts?.[0];
  if (!attempt) return true; // Backward-compatible handling for pre-migration payments.
  return attempt.providerPaymentId === payment?.id
    && attempt.amountMinor === amountMinor
    && attempt.currency === payment?.amount?.currency
    && (!attempt.reservationId || payment?.metadata?.reservationId === attempt.reservationId);
};

const matchesUnboundPaymentAttempt = (attempt: any, payment: any, amountMinor: number): boolean => (
  attempt
  && !attempt.providerPaymentId
  && attempt.amountMinor === amountMinor
  && attempt.currency === payment?.amount?.currency
  && typeof attempt.reservationId === 'string'
  && payment?.metadata?.reservationId === attempt.reservationId
);

// ============================================================
// POST /api/payment/create — СОЗДАНИЕ ПЛАТЕЖА
// ============================================================
export const createPaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    const userId = (req as any).user?.id;

    console.log('💳 Создание платежа для заказа:', orderId);
    console.log('  userId:', userId);

    if (!orderId) {
      res.status(400).json({ error: 'Не указан ID заказа' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // ✅ ПРОВЕРЯЕМ ЗАКАЗ (ТОЛЬКО СВОЙ)
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId,
      },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) {
      console.error('❌ Заказ не найден или не принадлежит пользователю');
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    console.log('✅ Заказ найден:', { 
      id: order.id, 
      total: order.total, 
      status: order.status,
      crmOrderId: order.crmOrderId 
    });

    // ✅ ЕСЛИ ЗАКАЗ УЖЕ ОПЛАЧЕН
    if (order.status === 'paid' || order.status === 'confirmed') {
      console.log('✅ Заказ уже оплачен, редирект на успех');
      res.json({
        success: true,
        paymentId: 'already_paid',
        paymentUrl: `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
        status: 'paid',
      });
      return;
    }

    // ✅ ЕСЛИ ЗАКАЗ УЖЕ В CRM — НЕ БЛОКИРУЕМ ОПЛАТУ, А СОЗДАЁМ ПЛАТЁЖ
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    const returnUrl = `${clientUrl}/payment/success?orderId=${orderId}`;

    const payment = await createPayment(orderId, returnUrl);

    res.json({
      success: true,
      paymentId: payment.paymentId,
      paymentUrl: payment.paymentUrl,
      status: payment.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка создания платежа:', error);
    if (error instanceof CheckoutInventoryError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.details || {}),
      });
      return;
    }
    if (error instanceof PaymentPreparationError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    res.status(400).json({ error: error.message || 'Ошибка создания платежа' });
  }
};

// ============================================================
// POST /api/payment/confirm — ПОДТВЕРЖДЕНИЕ ОПЛАТЫ (СО СТРАНИЦЫ УСПЕХА)
// ============================================================
export const confirmPaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, paymentId } = req.body;
    const userId = (req as any).user?.id;

    console.log(`💳 Подтверждение оплаты заказа ${orderId} для пользователя ${userId}`);

    if (!orderId || !paymentId) {
      res.status(400).json({ error: 'Не указаны ID заказа или платежа' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // ✅ ПРОВЕРЯЕМ, ЧТО ЗАКАЗ ПРИНАДЛЕЖИТ ПОЛЬЗОВАТЕЛЮ
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId,
      },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    if (!order.paymentId || order.paymentId !== paymentId) {
      res.status(409).json({ error: 'Платёж не связан с указанным заказом' });
      return;
    }

    // ✅ ЕСЛИ ЗАКАЗ УЖЕ ОБРАБОТАН — ВОЗВРАЩАЕМ УСПЕХ
    if (order.status === 'paid' && order.crmOrderId) {
      console.log(`ℹ️ Заказ ${orderId} уже оплачен и отправлен в CRM`);
      res.json({ 
        success: true, 
        orderId, 
        status: 'paid', 
        alreadyProcessed: true,
        crmOrderId: order.crmOrderId,
        documentNumber: order.orderNumber,
      });
      return;
    }

    // Redirect на страницу успеха не является подтверждением оплаты.
    // Перепроверяем платёж непосредственно в YooKassa.
    const payment = await getPaymentStatus(order.paymentId);
    const paymentAmountValue = payment?.amount?.value;
    const hasValidPaymentAmount = typeof paymentAmountValue === 'string'
      && /^\d+(?:\.\d{1,2})?$/.test(paymentAmountValue);
    const paymentAmountCents = hasValidPaymentAmount
      ? Math.round(Number(paymentAmountValue) * 100)
      : NaN;
    const orderAmountCents = Math.round(order.total * 100);

    if (
      payment?.id !== order.paymentId ||
      payment?.status !== 'succeeded' ||
      payment?.amount?.currency !== 'RUB' ||
      !Number.isSafeInteger(paymentAmountCents) ||
      paymentAmountCents !== orderAmountCents ||
      payment?.metadata?.orderId !== order.id ||
      !matchesDurablePaymentAttempt(order, payment, paymentAmountCents)
    ) {
      res.status(409).json({
        error: 'Платёж не подтверждён или его данные не соответствуют заказу',
        status: payment?.status || 'unknown',
      });
      return;
    }

    const result = await handlePaymentSuccess(orderId);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Ошибка подтверждения оплаты:', error);
    res.status(500).json({ error: error.message || 'Ошибка подтверждения оплаты' });
  }
};

// ============================================================
// POST /api/payment/webhook — WEBHOOK ОТ ЮKASSA
// ============================================================
export const paymentWebhookController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const body = rawBody.toString('utf8');

    console.log('📥 Получен webhook от ЮKassa');

    const event = JSON.parse(body);
    const notifiedPaymentId = event?.object?.id;
    if (typeof notifiedPaymentId !== 'string' || !notifiedPaymentId) {
      res.status(400).json({ error: 'Invalid payment notification' });
      return;
    }

    // YooKassa does not sign these notifications with a shared-secret HMAC.
    // Treat the notification as a hint and fetch the authoritative payment.
    const payment = await getPaymentStatus(notifiedPaymentId);
    const orderId = payment?.metadata?.orderId;
    if (payment?.id !== notifiedPaymentId || typeof orderId !== 'string' || !orderId) {
      res.status(400).json({ error: 'Invalid payment data' });
      return;
    }

    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) {
      res.status(409).json({ error: 'Payment is not linked to the order' });
      return;
    }

    const paymentAmountValue = payment?.amount?.value;
    const hasValidPaymentAmount = typeof paymentAmountValue === 'string'
      && /^\d+(?:\.\d{1,2})?$/.test(paymentAmountValue);
    const paymentAmountCents = hasValidPaymentAmount
      ? Math.round(Number(paymentAmountValue) * 100)
      : NaN;

    // Recover the exact crash window after YooKassa created the payment but
    // before its id was bound locally. The provider response is authoritative,
    // and the immutable reservation/amount facts prevent cross-order binding.
    const unboundAttempt = order.paymentAttempts?.[0];
    if (
      !order.paymentId
      && matchesUnboundPaymentAttempt(unboundAttempt, payment, paymentAmountCents)
    ) {
      const linked = await prisma.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, order!.id);
        const currentOrder = await tx.order.findUnique({ where: { id: order!.id } });
        if (!currentOrder || currentOrder.paymentId) return false;
        const attemptResult = await tx.paymentAttempt.updateMany({
          where: { id: unboundAttempt.id, providerPaymentId: null },
          data: {
            providerPaymentId: payment.id,
            status: payment.status === 'succeeded' ? 'succeeded' : payment.status === 'canceled' ? 'canceled' : 'pending',
            lastCheckedAt: new Date(),
          },
        });
        if (attemptResult.count !== 1) return false;
        const orderResult = await tx.order.updateMany({
          where: { id: order!.id, paymentId: null },
          data: { paymentId: payment.id },
        });
        if (orderResult.count !== 1) throw new Error('Concurrent payment binding conflict');
        return true;
      }, { maxWait: 5_000, timeout: 10_000 });
      if (linked) {
        order = {
          ...order,
          paymentId: payment.id,
          paymentAttempts: [{ ...unboundAttempt, providerPaymentId: payment.id }],
        };
      }
    }

    if (!order.paymentId || order.paymentId !== payment.id) {
      res.status(409).json({ error: 'Payment is not linked to the order' });
      return;
    }

    if (payment.status === 'succeeded') {
      const orderAmountCents = Math.round(order.total * 100);

      if (
        payment?.amount?.currency !== 'RUB' ||
        !Number.isSafeInteger(paymentAmountCents) ||
        paymentAmountCents !== orderAmountCents ||
        !matchesDurablePaymentAttempt(order, payment, paymentAmountCents)
      ) {
        res.status(409).json({ error: 'Payment amount does not match the order' });
        return;
      }
    }

    const result = await handlePaymentWebhook({ ...event, object: payment });
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ Ошибка обработки webhook:', error);
    res.status(500).json({ error: error.message || 'Ошибка обработки webhook' });
  }
};

// ============================================================
// GET /api/payment/status/:paymentId — СТАТУС ПЛАТЕЖА
// ============================================================
export const getPaymentStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    console.log('📊 Проверка статуса платежа:', paymentId);
    
    if (!paymentId) {
      res.status(400).json({ error: 'Не указан ID платежа' });
      return;
    }

    const id = Array.isArray(paymentId) ? paymentId[0] : paymentId;
    const status = await getPaymentStatus(id);
    
    res.json(status);
  } catch (error: any) {
    console.error('❌ Ошибка получения статуса платежа:', error);
    res.status(400).json({ error: error.message || 'Ошибка получения статуса платежа' });
  }
};

// ============================================================
// POST /api/payment/resend — ПРИНУДИТЕЛЬНАЯ ОТПРАВКА В CRM (ДЛЯ АДМИНОВ)
// ============================================================
export const resendPaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    const userId = (req as any).user?.id;

    console.log(`🔄 Принудительная отправка заказа ${orderId} в CRM`);

    if (!orderId) {
      res.status(400).json({ error: 'Не указан ID заказа' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // ✅ ПРОВЕРЯЕМ, ЧТО ПОЛЬЗОВАТЕЛЬ — АДМИН ИЛИ МЕНЕДЖЕР
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const result = await resendOrderToCRM(orderId);
    res.json(result);
  } catch (error: any) {
    console.error('❌ Ошибка принудительной отправки:', error);
    res.status(500).json({ error: error.message || 'Ошибка принудительной отправки' });
  }
};

export const completeMockPaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production' || getPaymentProvider() !== 'mock') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const { orderId, paymentId } = req.body;
    const userId = (req as any).user?.id;
    if (!orderId || !paymentId) {
      res.status(400).json({ error: 'Не указаны ID заказа или платежа' });
      return;
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order || order.paymentId !== paymentId) {
      res.status(404).json({ error: 'Платёж не найден' });
      return;
    }

    const payment = completeMockPayment(paymentId, orderId);
    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ошибка mock-платежа' });
  }
};
