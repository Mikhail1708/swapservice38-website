// backend/src/routes/articles.routes.ts
import { Router } from 'express';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../controllers/articles.controller'; // ✅ ПРАВИЛЬНЫЙ ИМПОРТ
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Публичные (без авторизации)
router.get('/', getArticles);
router.get('/:id', getArticleById);

// Требуют авторизации (admin/manager)
router.post('/', authMiddleware, createArticle);
router.put('/:id', authMiddleware, updateArticle);
router.delete('/:id', authMiddleware, deleteArticle);

export default router;