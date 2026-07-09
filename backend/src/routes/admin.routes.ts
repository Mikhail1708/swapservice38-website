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
  updateUserRole,
  blockUser,
  unblockUser,
} from '../controllers/admin/users.controller';

// ✅ ARTICLES (СВАПЫ + УСЛУГИ)
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../controllers/admin/content.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

// ===== DASHBOARD =====
router.get('/dashboard/stats', getDashboardStats);

// ===== ORDERS =====
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
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
router.patch('/users/:id/role', updateUserRole);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

// ===== ARTICLES =====
router.get('/articles', getArticles);
router.get('/articles/:id', getArticleById);
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.delete('/articles/:id', deleteArticle);


export default router;