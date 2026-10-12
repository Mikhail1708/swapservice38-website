"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_middleware_1 = require("../middleware/validate.middleware");
const order_schema_1 = require("../schemas/order.schema");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const invoice_controller_1 = require("../controllers/invoice.controller");
const invoicePdf_controller_1 = require("../controllers/invoicePdf.controller");
// ✅ ДОБАВЛЯЕМ ТИП
const router = (0, express_1.Router)();
// ✅ ВСЕ РОУТЫ С ВАЛИДАЦИЕЙ
router.post('/', auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(order_schema_1.createOrderSchema), order_controller_1.createOrderController);
router.get('/', auth_middleware_1.requireAuth, order_controller_1.getUserOrdersController);
router.get('/:id/invoice', auth_middleware_1.requireAuth, invoice_controller_1.getInvoiceStateController);
router.get('/:id/invoice/pdf', auth_middleware_1.requireAuth, invoicePdf_controller_1.downloadInvoicePdf);
router.post('/:id/invoice', auth_middleware_1.requireAuth, invoice_controller_1.requestInvoiceController);
router.get('/:id', auth_middleware_1.requireAuth, order_controller_1.getOrderController);
router.post('/:id/cancellation', auth_middleware_1.requireAuth, order_controller_1.requestOrderCancellationController);
router.delete('/:id', auth_middleware_1.requireAuth, order_controller_1.deleteOrderController);
exports.default = router;
//# sourceMappingURL=order.routes.js.map