"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/likes.routes.ts
const express_1 = require("express");
const likes_controller_1 = require("../controllers/likes.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/', auth_middleware_1.requireAuth, likes_controller_1.toggleLike);
router.get('/user', auth_middleware_1.requireAuth, likes_controller_1.getUserLikes); // ✅ ДОБАВЛЯЕМ ЭТОТ РОУТ
exports.default = router;
//# sourceMappingURL=likes.routes.js.map