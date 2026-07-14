// backend/src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  createPayment, 
  handlePaymentSuccess, 
  handlePaymentWebhook, 
  verifyWebhookSignature, 
  getPaymentStatus,
  resendOrderToCRM
} from '../services/payment.service';

const prisma = new PrismaClient();

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
    });

    if (!order) {
      console.error('❌ Заказ не найден или не принадлежит пользователю');
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    console.log('✅ Заказ найден:', { id: order.id, total: order.total, status: order.status });

    // ✅ ЕСЛИ ЗАКАЗ УЖЕ ОПЛАЧЕН
    if (order.status === 'paid') {
      console.log('⚠️ Заказ уже оплачен');
      res.json({
        success: true,
        paymentId: 'already_paid',
        paymentUrl: `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
        status: 'paid',
      });
      return;
    }

    // ✅ ЕСЛИ ЗАКАЗ УЖЕ ОТПРАВЛЕН В CRM
    if (order.crmOrderId) {
      console.log('⚠️ Заказ уже отправлен в CRM');
      res.status(400).json({ error: 'Заказ уже обработан' });
      return;
    }

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

    if (!orderId) {
      res.status(400).json({ error: 'Не указан ID заказа' });
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
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
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

    // ✅ ВЫЗЫВАЕМ handlePaymentSuccess
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
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature = req.headers['x-yookassa-signature'] as string || null;

    console.log('📥 Получен webhook от ЮKassa');

    if (process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(body, signature)) {
        console.error('❌ Неверная подпись webhook');
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await handlePaymentWebhook(event);
    
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