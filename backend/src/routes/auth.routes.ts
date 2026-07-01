import { Router } from 'express';
import { registerController, verifyController, loginController, logoutController, meController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', registerController);
router.post('/verify', verifyController);
router.post('/login', loginController);
router.post('/logout', logoutController);
router.get('/me', authMiddleware, meController);

export default router;