// backend/src/routes/likes.routes.ts
import { Router } from 'express';
import { toggleLike, getUserLikes } from '../controllers/likes.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, toggleLike);
router.get('/user', requireAuth, getUserLikes); // ✅ ДОБАВЛЯЕМ ЭТОТ РОУТ

export default router;
