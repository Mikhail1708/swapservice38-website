"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/cart.routes.ts (обновляем, добавим валидацию)
const express_1 = require("express");
const validate_middleware_1 = require("../middleware/validate.middleware");
const zod_1 = require("zod");
const cart_controller_1 = require("../controllers/cart.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// СХЕМЫ
const addToCartSchema = zod_1.z.object({
    productId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => String(val)),
    quantity: zod_1.z.number().int().min(1).default(1),
});
const updateCartSchema = zod_1.z.object({
    productId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => String(val)),
    quantity: zod_1.z.number().int().min(0),
});
router.get('/', auth_middleware_1.optionalAuth, cart_controller_1.getCart);
router.post('/add', auth_middleware_1.optionalAuth, (0, validate_middleware_1.validate)(addToCartSchema), cart_controller_1.addToCart);
router.put('/update', auth_middleware_1.optionalAuth, (0, validate_middleware_1.validate)(updateCartSchema), cart_controller_1.updateCart);
router.delete('/clear', auth_middleware_1.optionalAuth, cart_controller_1.clearCart);
exports.default = router;
//# sourceMappingURL=cart.routes.js.map