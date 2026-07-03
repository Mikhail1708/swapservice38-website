// backend/src/routes/payment.routes.ts
import { Router } from 'express';
import {
  createPaymentController,
  paymentWebhookController,
  getPaymentStatusController,
} from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ✅ ТОЛЬКО АВТОРИЗОВАННЫЕ
router.post('/create', authMiddleware, createPaymentController);

// ✅ ПУБЛИЧНЫЙ WEBHOOK (ЮKassa будет стучаться сюда)
router.post('/webhook', paymentWebhookController);

// ✅ ПРОВЕРКА СТАТУСА
router.get('/status/:paymentId', getPaymentStatusController);

export default router;