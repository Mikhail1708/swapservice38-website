// backend/src/routes/payment.routes.ts
import { Router } from 'express';
import {
  createPaymentController,
  confirmPaymentController,
  paymentWebhookController,
  getPaymentStatusController,
  resendPaymentController,
  completeMockPaymentController,
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ✅ ПУБЛИЧНЫЙ WEBHOOK (ЮKassa будет стучаться сюда)
router.post('/webhook', paymentWebhookController);

// ✅ ТОЛЬКО АВТОРИЗОВАННЫЕ
router.post('/create', requireAuth, createPaymentController);

// ✅ ПОДТВЕРЖДЕНИЕ ОПЛАТЫ (СО СТРАНИЦЫ УСПЕХА)
router.post('/confirm', requireAuth, confirmPaymentController);

if (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_PROVIDER === 'mock') {
  router.post('/mock/complete', requireAuth, completeMockPaymentController);
}

// ✅ ПРОВЕРКА СТАТУСА
router.get('/status/:paymentId', requireAuth, getPaymentStatusController);

// ✅ ПРИНУДИТЕЛЬНАЯ ОТПРАВКА В CRM (ДЛЯ АДМИНОВ)
router.post('/resend', requireAuth, resendPaymentController);

export default router;
