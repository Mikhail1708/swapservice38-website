import { Router } from 'express';
import { getPublicServices, getPublicServiceById } from '../controllers/services.controller';

const router = Router();

router.get('/', getPublicServices);
router.get('/:id', getPublicServiceById);

export default router;