"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/articles.routes.ts
const express_1 = require("express");
const articles_controller_1 = require("../controllers/articles.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
// Публичные (без авторизации)
router.get('/', articles_controller_1.getArticles);
router.get('/:id', articles_controller_1.getArticleById);
// Требуют авторизации (admin/manager)
router.post('/', auth_middleware_1.requireAuth, role_middleware_1.requireAdmin, articles_controller_1.createArticle);
router.put('/:id', auth_middleware_1.requireAuth, role_middleware_1.requireAdmin, articles_controller_1.updateArticle);
router.delete('/:id', auth_middleware_1.requireAuth, role_middleware_1.requireAdmin, articles_controller_1.deleteArticle);
exports.default = router;
//# sourceMappingURL=articles.routes.js.map