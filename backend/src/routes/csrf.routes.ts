// backend/src/routes/csrf.routes.ts
import { Router } from 'express';
import { getCsrfToken } from '../middleware/csrf.middleware';

const router = Router();

// GET /api/csrf-token — получить CSRF токен
router.get('/', getCsrfToken);

export default router;