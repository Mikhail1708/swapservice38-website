"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/product.routes.ts (САЙТ, порт 5001)
const express_1 = require("express");
const product_controller_1 = require("../controllers/product.controller");
const router = (0, express_1.Router)();
// Availability is fetched from CRM on every request. This does not affect image caching.
router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
// ✅ ВАЖНО: сначала идут статические роуты, потом динамические
router.get('/categories', product_controller_1.getCategories);
router.get('/category/:category', product_controller_1.getProductsByCategory);
router.get('/', product_controller_1.getProducts);
router.get('/:id', product_controller_1.getProductById); // :id должен быть ПОСЛЕДНИМ!
exports.default = router;
//# sourceMappingURL=product.routes.js.map