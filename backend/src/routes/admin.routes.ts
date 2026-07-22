// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
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
  retryOrderToCRM, // ✅ НОВЫЙ ИМПОРТ
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
} from '../controllers/admin/users.controller';

// ARTICLES
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
// QUEUE
import { getCRMQueueStats, retryFailedOrders } from '../queues/crm.queue';

const router = Router();

// Все маршруты требуют авторизации
router.use(authMiddleware);
router.use(requireAdmin);

// ===== DASHBOARD =====
router.get('/dashboard/stats', getDashboardStats);

// ===== ORDERS =====
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id', updateOrder);
router.delete('/orders/:id', deleteOrder);
router.post('/orders/:id/delete-with-password', deleteOrderWithPassword);
router.post('/orders/:id/retry', retryOrderToCRM); // ✅ НОВЫЙ МАРШРУТ

// ===== USERS =====
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/role', updateUserRole);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.put('/users/:id/password', changeUserPassword);

// ===== ARTICLES =====
router.get('/articles', getArticles);
router.get('/articles/:id', getArticleById);
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.delete('/articles/:id', deleteArticle);
// ===== SERVICES (УСЛУГИ) =====
router.get('/services', getServices);
router.get('/services/:id', getServiceById);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// ===== QUEUE (CRM) =====
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await getCRMQueueStats();
    log.debug('📊 Статистика очереди CRM', stats);
    res.json(stats);
  } catch (error: any) {
    log.error('❌ Ошибка получения статистики очереди', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/queue/retry', async (req, res) => {
  try {
    const result = await retryFailedOrders();
    log.info('🔄 Повторная отправка неудавшихся задач', { retried: result.retried });
    res.json({ success: true, ...result });
  } catch (error: any) {
    log.error('❌ Ошибка повторной отправки задач', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;