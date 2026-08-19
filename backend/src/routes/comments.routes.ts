// backend/src/routes/comments.routes.ts
import { Router } from 'express';
import { createComment } from '../controllers/comments.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ✅ УБИРАЕМ GET — он не нужен, комментарии приходят из articles
router.post('/', requireAuth, createComment);

export default router;
