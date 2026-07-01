import { Router } from 'express';
import { 
  createOrderController, 
  getOrderController,
  getOrderStatusFromCRMController 
} from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Создание заказа (доступно всем)
router.post('/', createOrderController);

// Получение заказа по ID (авторизованным и гостям с guestId)
router.get('/:id', getOrderController);

// Получение статуса заказа из CRM
router.get('/status/:crmOrderId', authMiddleware, getOrderStatusFromCRMController);

export default router;