// backend/src/routes/product.routes.ts
import { Router } from 'express';
import { 
  getProducts, 
  getProductById,
  getCategories,
  getProductsByCategory
} from '../controllers/product.controller';

const router = Router();

// Получение всех товаров
router.get('/', getProducts);

// Получение товара по ID
router.get('/:id', getProductById);

// Получение категорий
router.get('/categories', getCategories);

// Получение товаров по категории
router.get('/category/:category', getProductsByCategory);

export default router;