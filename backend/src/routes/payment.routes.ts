// backend/src/routes/payment.routes.ts
import { Router } from 'express';
import {
  createPaymentController,
  confirmPaymentController,
  paymentWebhookController,
  getPaymentStatusController,
  resendPaymentController,
} from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ✅ ПУБЛИЧНЫЙ WEBHOOK (ЮKassa будет стучаться сюда)
router.post('/webhook', paymentWebhookController);

// ✅ ТОЛЬКО АВТОРИЗОВАННЫЕ
router.post('/create', authMiddleware, createPaymentController);

// ✅ ПОДТВЕРЖДЕНИЕ ОПЛАТЫ (СО СТРАНИЦЫ УСПЕХА)
router.post('/confirm', authMiddleware, confirmPaymentController);

// ✅ ПРОВЕРКА СТАТУСА
router.get('/status/:paymentId', getPaymentStatusController);

// ✅ ПРИНУДИТЕЛЬНАЯ ОТПРАВКА В CRM (ДЛЯ АДМИНОВ)
router.post('/resend', authMiddleware, resendPaymentController);

export default router;