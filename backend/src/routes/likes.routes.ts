// backend/src/routes/likes.routes.ts
import { Router } from 'express';
import { toggleLike } from '../controllers/likes.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authMiddleware, toggleLike);

export default router;