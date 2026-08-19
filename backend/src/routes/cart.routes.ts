// backend/src/routes/cart.routes.ts (обновляем, добавим валидацию)
import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';
import {
  getCart,
  addToCart,
  updateCart,
  clearCart,
} from '../controllers/cart.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// СХЕМЫ
const addToCartSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform((val) => String(val)),
  quantity: z.number().int().min(1).default(1),
});

const updateCartSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform((val) => String(val)),
  quantity: z.number().int().min(0),
});

router.get('/', optionalAuth, getCart);
router.post('/add', optionalAuth, validate(addToCartSchema), addToCart);
router.put('/update', optionalAuth, validate(updateCartSchema), updateCart);
router.delete('/clear', optionalAuth, clearCart);

export default router;
