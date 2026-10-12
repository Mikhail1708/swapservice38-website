"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/admin.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const comments_controller_1 = require("../controllers/admin/comments.controller");
const async_middleware_1 = require("../middleware/async.middleware");
const logger_1 = require("../config/logger");
// Dashboard
const dashboard_controller_1 = require("../controllers/admin/dashboard.controller");
// Orders
const orders_controller_1 = require("../controllers/admin/orders.controller");
// Users
const users_controller_1 = require("../controllers/admin/users.controller");
// CONTENT (Articles, News, Services)
const content_controller_1 = require("../controllers/admin/content.controller");
const content_controller_2 = require("../controllers/admin/content.controller");
// ===== SETTINGS =====
const settings_controller_1 = require("../controllers/admin/settings.controller");
// QUEUE
const crm_queue_1 = require("../queues/crm.queue");
const router = (0, express_1.Router)();
// Все маршруты требуют авторизации
router.use(auth_middleware_1.requireAuth);
router.use(role_middleware_1.requireAdmin);
router.delete('/comments/:id', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(comments_controller_1.deleteComment));
router.get('/articles/:id/comments', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(comments_controller_1.getArticleComments));
// ===== DASHBOARD =====
router.get('/dashboard/stats', (0, async_middleware_1.asyncHandler)(dashboard_controller_1.getDashboardStats));
// ===== ORDERS =====
router.get('/orders', (0, async_middleware_1.asyncHandler)(orders_controller_1.getOrders));
router.get('/orders/:id', (0, async_middleware_1.asyncHandler)(orders_controller_1.getOrderById));
router.patch('/orders/:id/status', (0, async_middleware_1.asyncHandler)(orders_controller_1.updateOrderStatus));
router.put('/orders/:id', (0, async_middleware_1.asyncHandler)(orders_controller_1.updateOrder));
router.delete('/orders/:id', (0, async_middleware_1.asyncHandler)(orders_controller_1.deleteOrder));
router.post('/orders/:id/delete-with-password', (0, async_middleware_1.asyncHandler)(orders_controller_1.deleteOrderWithPassword));
router.post('/orders/:id/retry', (0, async_middleware_1.asyncHandler)(orders_controller_1.retryOrderToCRM));
router.post('/orders/:id/refund/retry', (0, async_middleware_1.asyncHandler)(orders_controller_1.retryFailedRefund));
router.post('/orders/mass-delete', (0, async_middleware_1.asyncHandler)(orders_controller_1.massDeleteOrders));
router.post('/orders/mass-delete-with-password', (0, async_middleware_1.asyncHandler)(orders_controller_1.massDeleteOrdersWithPassword));
// ===== USERS =====
router.get('/users', (0, async_middleware_1.asyncHandler)(users_controller_1.getUsers));
router.get('/users/:id', (0, async_middleware_1.asyncHandler)(users_controller_1.getUserById));
router.post('/users', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.createUser));
router.put('/users/:id', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.updateUser));
router.delete('/users/:id', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.deleteUser));
router.patch('/users/:id/role', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.updateUserRole));
router.post('/users/:id/block', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.blockUser));
router.post('/users/:id/unblock', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.unblockUser));
router.put('/users/:id/password', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.changeUserPassword));
router.post('/users/mass-delete', role_middleware_1.requireAdminOnly, (0, async_middleware_1.asyncHandler)(users_controller_1.massDeleteUsers));
// ===== ARTICLES =====
router.get('/articles', (0, async_middleware_1.asyncHandler)(content_controller_1.getArticles));
router.get('/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.getArticleById));
router.post('/articles', (0, async_middleware_1.asyncHandler)(content_controller_1.createArticle));
router.put('/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.updateArticle));
router.delete('/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.deleteArticle));
// ✅ АЛИАСЫ ДЛЯ /content/articles (для совместимости с фронтендом)
router.get('/content/articles', (0, async_middleware_1.asyncHandler)(content_controller_1.getArticles));
router.get('/content/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.getArticleById));
router.post('/content/articles', (0, async_middleware_1.asyncHandler)(content_controller_1.createArticle));
router.put('/content/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.updateArticle));
router.delete('/content/articles/:id', (0, async_middleware_1.asyncHandler)(content_controller_1.deleteArticle));
// ===== SERVICES (УСЛУГИ) =====
router.get('/services', (0, async_middleware_1.asyncHandler)(content_controller_2.getServices));
router.get('/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.getServiceById));
router.post('/services', (0, async_middleware_1.asyncHandler)(content_controller_2.createService));
router.put('/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.updateService));
router.delete('/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.deleteService));
// ✅ АЛИАСЫ ДЛЯ /content/services (для совместимости с фронтендом)
router.get('/content/services', (0, async_middleware_1.asyncHandler)(content_controller_2.getServices));
router.get('/content/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.getServiceById));
router.post('/content/services', (0, async_middleware_1.asyncHandler)(content_controller_2.createService));
router.put('/content/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.updateService));
router.delete('/content/services/:id', (0, async_middleware_1.asyncHandler)(content_controller_2.deleteService));
// ===== SETTINGS =====
router.get('/settings', (0, async_middleware_1.asyncHandler)(settings_controller_1.getSettings));
router.put('/settings', (0, async_middleware_1.asyncHandler)(settings_controller_1.updateSettings));
router.get('/settings/maintenance', (0, async_middleware_1.asyncHandler)(settings_controller_1.getMaintenanceStatus));
// ===== QUEUE (CRM) =====
router.get('/queue/stats', async (req, res) => {
    try {
        const stats = await (0, crm_queue_1.getCRMQueueStats)();
        logger_1.log.debug('📊 Статистика очереди CRM', stats);
        res.json(stats);
    }
    catch (error) {
        logger_1.log.error('❌ Ошибка получения статистики очереди', { error: error.message });
        res.status(500).json({ error: 'Не удалось получить статистику очереди' });
    }
});
router.post('/queue/retry', async (req, res) => {
    try {
        const result = await (0, crm_queue_1.retryFailedOrders)();
        logger_1.log.info('🔄 Повторная отправка неудавшихся задач', { retried: result.retried });
        res.json({ success: true, ...result });
    }
    catch (error) {
        logger_1.log.error('❌ Ошибка повторной отправки задач', { error: error.message });
        res.status(500).json({ error: 'Не удалось повторно отправить задачи' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map