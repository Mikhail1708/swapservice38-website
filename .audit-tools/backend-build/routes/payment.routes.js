"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/payment.routes.ts
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ ПУБЛИЧНЫЙ WEBHOOK (ЮKassa будет стучаться сюда)
router.post('/webhook', payment_controller_1.paymentWebhookController);
// ✅ ТОЛЬКО АВТОРИЗОВАННЫЕ
router.post('/create', auth_middleware_1.requireAuth, payment_controller_1.createPaymentController);
// ✅ ПОДТВЕРЖДЕНИЕ ОПЛАТЫ (СО СТРАНИЦЫ УСПЕХА)
router.post('/confirm', auth_middleware_1.requireAuth, payment_controller_1.confirmPaymentController);
if (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_PROVIDER === 'mock') {
    router.post('/mock/complete', auth_middleware_1.requireAuth, payment_controller_1.completeMockPaymentController);
}
// ✅ ПРОВЕРКА СТАТУСА
router.get('/status/:paymentId', auth_middleware_1.requireAuth, payment_controller_1.getPaymentStatusController);
// ✅ ПРИНУДИТЕЛЬНАЯ ОТПРАВКА В CRM (ДЛЯ АДМИНОВ)
router.post('/resend', auth_middleware_1.requireAuth, payment_controller_1.resendPaymentController);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map