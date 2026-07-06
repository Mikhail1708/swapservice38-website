// backend/src/routes/order.routes.ts
import { Router } from 'express';
import { 
  createOrderController, 
  getOrderController,
  getUserOrdersController,
  deleteOrderController,  // 👈 ДОБАВИТЬ
} from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authMiddleware, createOrderController);
router.get('/', authMiddleware, getUserOrdersController);
router.get('/:id', authMiddleware, getOrderController);
router.delete('/:id', authMiddleware, deleteOrderController);  // 👈 ДОБАВИТЬ

export default router;