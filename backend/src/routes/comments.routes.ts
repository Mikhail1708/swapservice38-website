// backend/src/routes/comments.routes.ts
import { Router } from 'express';
import { createComment } from '../controllers/comments.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authMiddleware, createComment);

export default router;