import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema } from '../schemas/order.schema';
import { 
  createOrderController, 
  getOrderController,
  getUserOrdersController,
  deleteOrderController,
  requestOrderCancellationController,
} from '../controllers/order.controller';
import { requireAuth } from '../middleware/auth.middleware';

// ✅ ДОБАВЛЯЕМ ТИП
const router: Router = Router();

// ✅ ВСЕ РОУТЫ С ВАЛИДАЦИЕЙ
router.post('/', requireAuth, validate(createOrderSchema), createOrderController);
router.get('/', requireAuth, getUserOrdersController);
router.get('/:id', requireAuth, getOrderController);
router.post('/:id/cancellation', requireAuth, requestOrderCancellationController);
router.delete('/:id', requireAuth, deleteOrderController);

export default router;
