// backend/src/routes/product.routes.ts (САЙТ, порт 5001)
import { Router } from 'express';
import { 
  getProducts, 
  getProductById,
  getCategories,
  getProductsByCategory
} from '../controllers/product.controller';

const router = Router();

// Availability is fetched from CRM on every request. This does not affect image caching.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ✅ ВАЖНО: сначала идут статические роуты, потом динамические
router.get('/categories', getCategories);
router.get('/category/:category', getProductsByCategory);
router.get('/', getProducts);
router.get('/:id', getProductById); // :id должен быть ПОСЛЕДНИМ!

export default router;
