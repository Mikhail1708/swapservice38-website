// backend/src/routes/likes.routes.ts
import { Router } from 'express';
import { toggleLike, getUserLikes } from '../controllers/likes.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authMiddleware, toggleLike);
router.get('/user', authMiddleware, getUserLikes); // ✅ ДОБАВЛЯЕМ ЭТОТ РОУТ

export default router;