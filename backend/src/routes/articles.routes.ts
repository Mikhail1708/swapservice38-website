// backend/src/routes/articles.routes.ts
import { Router } from 'express';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../controllers/articles.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

// Публичные (без авторизации)
router.get('/', getArticles);
router.get('/:id', getArticleById);

// Требуют авторизации (admin/manager)
router.post('/', requireAuth, requireAdmin, createArticle);
router.put('/:id', requireAuth, requireAdmin, updateArticle);
router.delete('/:id', requireAuth, requireAdmin, deleteArticle);

export default router;
