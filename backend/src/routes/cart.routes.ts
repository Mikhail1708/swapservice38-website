// backend/src/routes/cart.routes.ts
import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCart,
  clearCart,
} from '../controllers/cart.controller';

const router = Router();

// Все эндпоинты публичные (с guestId)
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCart);
router.delete('/clear', clearCart);

export default router;