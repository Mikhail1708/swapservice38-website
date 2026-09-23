// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin, requireAdminOnly } from '../middleware/role.middleware';
import { deleteComment, getArticleComments } from '../controllers/admin/comments.controller';
import { asyncHandler } from '../middleware/async.middleware';
import { log } from '../config/logger';

// Dashboard
import { getDashboardStats } from '../controllers/admin/dashboard.controller';

// Orders
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  updateOrder,
  deleteOrderWithPassword,
  retryOrderToCRM,
  retryFailedRefund,
  massDeleteOrders,
  massDeleteOrdersWithPassword,
} from '../controllers/admin/orders.controller';

// Users
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
  blockUser,
  unblockUser,
  changeUserPassword,
  massDeleteUsers,
} from '../controllers/admin/users.controller';

// CONTENT (Articles, News, Services)
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../controllers/admin/content.controller';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../controllers/admin/content.controller';

// ===== SETTINGS =====
import {
  getSettings,
  updateSettings,
  getMaintenanceStatus,
} from '../controllers/admin/settings.controller';

// QUEUE
import { getCRMQueueStats, retryFailedOrders } from '../queues/crm.queue';

const router = Router();

// Все маршруты требуют авторизации
router.use(requireAuth);
router.use(requireAdmin);

router.delete('/comments/:id', requireAdminOnly, asyncHandler(deleteComment));
router.get('/articles/:id/comments', requireAdminOnly, asyncHandler(getArticleComments));

// ===== DASHBOARD =====
router.get('/dashboard/stats', asyncHandler(getDashboardStats));

// ===== ORDERS =====
router.get('/orders', asyncHandler(getOrders));
router.get('/orders/:id', asyncHandler(getOrderById));
router.patch('/orders/:id/status', asyncHandler(updateOrderStatus));
router.put('/orders/:id', asyncHandler(updateOrder));
router.delete('/orders/:id', asyncHandler(deleteOrder));
router.post('/orders/:id/delete-with-password', asyncHandler(deleteOrderWithPassword));
router.post('/orders/:id/retry', asyncHandler(retryOrderToCRM));
router.post('/orders/:id/refund/retry', asyncHandler(retryFailedRefund));
router.post('/orders/mass-delete', asyncHandler(massDeleteOrders));
router.post('/orders/mass-delete-with-password', asyncHandler(massDeleteOrdersWithPassword));

// ===== USERS =====
router.get('/users', asyncHandler(getUsers));
router.get('/users/:id', asyncHandler(getUserById));
router.post('/users', requireAdminOnly, asyncHandler(createUser));
router.put('/users/:id', requireAdminOnly, asyncHandler(updateUser));
router.delete('/users/:id', requireAdminOnly, asyncHandler(deleteUser));
router.patch('/users/:id/role', requireAdminOnly, asyncHandler(updateUserRole));
router.post('/users/:id/block', requireAdminOnly, asyncHandler(blockUser));
router.post('/users/:id/unblock', requireAdminOnly, asyncHandler(unblockUser));
router.put('/users/:id/password', requireAdminOnly, asyncHandler(changeUserPassword));
router.post('/users/mass-delete', requireAdminOnly, asyncHandler(massDeleteUsers));

// ===== ARTICLES =====
router.get('/articles', asyncHandler(getArticles));
router.get('/articles/:id', asyncHandler(getArticleById));
router.post('/articles', asyncHandler(createArticle));
router.put('/articles/:id', asyncHandler(updateArticle));
router.delete('/articles/:id', asyncHandler(deleteArticle));

// ✅ АЛИАСЫ ДЛЯ /content/articles (для совместимости с фронтендом)
router.get('/content/articles', asyncHandler(getArticles));
router.get('/content/articles/:id', asyncHandler(getArticleById));
router.post('/content/articles', asyncHandler(createArticle));
router.put('/content/articles/:id', asyncHandler(updateArticle));
router.delete('/content/articles/:id', asyncHandler(deleteArticle));

// ===== SERVICES (УСЛУГИ) =====
router.get('/services', asyncHandler(getServices));
router.get('/services/:id', asyncHandler(getServiceById));
router.post('/services', asyncHandler(createService));
router.put('/services/:id', asyncHandler(updateService));
router.delete('/services/:id', asyncHandler(deleteService));

// ✅ АЛИАСЫ ДЛЯ /content/services (для совместимости с фронтендом)
router.get('/content/services', asyncHandler(getServices));
router.get('/content/services/:id', asyncHandler(getServiceById));
router.post('/content/services', asyncHandler(createService));
router.put('/content/services/:id', asyncHandler(updateService));
router.delete('/content/services/:id', asyncHandler(deleteService));

// ===== SETTINGS =====
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', asyncHandler(updateSettings));
router.get('/settings/maintenance', asyncHandler(getMaintenanceStatus));

// ===== QUEUE (CRM) =====
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await getCRMQueueStats();
    log.debug('📊 Статистика очереди CRM', stats);
    res.json(stats);
  } catch (error: any) {
    log.error('❌ Ошибка получения статистики очереди', { error: error.message });
    res.status(500).json({ error: 'Не удалось получить статистику очереди' });
  }
});

router.post('/queue/retry', async (req, res) => {
  try {
    const result = await retryFailedOrders();
    log.info('🔄 Повторная отправка неудавшихся задач', { retried: result.retried });
    res.json({ success: true, ...result });
  } catch (error: any) {
    log.error('❌ Ошибка повторной отправки задач', { error: error.message });
    res.status(500).json({ error: 'Не удалось повторно отправить задачи' });
  }
});

export default router;
