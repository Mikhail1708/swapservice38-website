import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema } from '../schemas/order.schema';
import { 
  createOrderController, 
  getOrderController,
  getUserOrdersController,
  deleteOrderController,
  requestOrderCancellationController,
} from '../controllers/order.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { getInvoiceStateController, requestInvoiceController } from '../controllers/invoice.controller';
import { downloadInvoicePdf } from '../controllers/invoicePdf.controller';

// ✅ ДОБАВЛЯЕМ ТИП
const router: Router = Router();

// ✅ ВСЕ РОУТЫ С ВАЛИДАЦИЕЙ
router.post('/', requireAuth, validate(createOrderSchema), createOrderController);
router.get('/', requireAuth, getUserOrdersController);
router.get('/:id/invoice', requireAuth, getInvoiceStateController);
router.get('/:id/invoice/pdf', requireAuth, downloadInvoicePdf);
router.post('/:id/invoice', requireAuth, requestInvoiceController);
router.get('/:id', requireAuth, getOrderController);
router.post('/:id/cancellation', requireAuth, requestOrderCancellationController);
router.delete('/:id', requireAuth, deleteOrderController);

export default router;
