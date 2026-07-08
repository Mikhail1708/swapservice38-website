// backend/src/routes/webhook.routes.ts
import { Router } from 'express';
import {
  handleOrderStatusWebhook,
  webhookHealthCheck,
} from '../controllers/webhook.controller';

const router = Router();

// Приём вебхуков от CRM
router.post('/crm/order-status', handleOrderStatusWebhook);

// Health check для вебхук-эндпоинта
router.get('/health', webhookHealthCheck);

export default router;