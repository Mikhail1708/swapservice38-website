"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/webhook.routes.ts (САЙТ)
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = (0, express_1.Router)();
// Приём вебхуков от CRM
router.post('/crm/order-status', webhook_controller_1.handleOrderStatusWebhook);
// Health check для вебхук-эндпоинта
router.get('/health', webhook_controller_1.webhookHealthCheck);
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map