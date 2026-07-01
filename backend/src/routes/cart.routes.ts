import { Router } from 'express';
import {
  addToCartController,
  getCartController,
  updateCartItemController,
  clearCartController,
} from '../controllers/cart.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Для авторизованных и гостей
router.get('/', getCartController);
router.post('/add', addToCartController);
router.put('/update', updateCartItemController);
router.delete('/clear', clearCartController);

export default router;