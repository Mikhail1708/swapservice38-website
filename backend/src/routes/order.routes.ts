// backend/src/routes/order.routes.ts
import { Router } from 'express';
import { 
  createOrderController, 
  getOrderController,
  getUserOrdersController,
} from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ✅ ТОЛЬКО АВТОРИЗОВАННЫЕ
router.post('/', authMiddleware, createOrderController);
router.get('/', authMiddleware, getUserOrdersController);
router.get('/:id', authMiddleware, getOrderController);

export default router;