// backend/src/routes/order.routes.ts (обновляем)
import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema } from '../schemas/order.schema';
import { 
  createOrderController, 
  getOrderController,
  getUserOrdersController,
  deleteOrderController,
} from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ✅ ВСЕ РОУТЫ С ВАЛИДАЦИЕЙ
router.post('/', authMiddleware, validate(createOrderSchema), createOrderController);
router.get('/', authMiddleware, getUserOrdersController);
router.get('/:id', authMiddleware, getOrderController);
router.delete('/:id', authMiddleware, deleteOrderController);

export default router;