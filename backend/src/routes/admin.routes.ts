// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

// Dashboard
import { getDashboardStats } from '../controllers/admin/dashboard.controller';

// Orders
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  updateOrder, // ✅ ДОБАВЛЯЕМ
} from '../controllers/admin/orders.controller';

// Appointments
import {
  getAppointments,
  getAppointmentsCalendar,
  getAppointmentById,
  updateAppointment,
  createAppointment,
} from '../controllers/admin/appointments.controller';

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
router.put('/orders/:id', updateOrder); // ✅ ДОБАВЛЯЕМ
router.delete('/orders/:id', deleteOrder);

// ===== APPOINTMENTS =====
router.get('/appointments', getAppointments);
router.get('/appointments/calendar', getAppointmentsCalendar);
router.get('/appointments/:id', getAppointmentById);
router.post('/appointments', createAppointment);
router.patch('/appointments/:id', updateAppointment);

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

export default router;