// frontend/backend/src/routes/cart.routes.ts
import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCart,
  clearCart,
} from '../controllers/cart.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ✅ ДОБАВЛЯЕМ authMiddleware КО ВСЕМ РОУТАМ
router.get('/', authMiddleware, getCart);
router.post('/add', authMiddleware, addToCart);
router.put('/update', authMiddleware, updateCart);
router.delete('/clear', authMiddleware, clearCart);

export default router;