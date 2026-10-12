"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/comments.routes.ts
const express_1 = require("express");
const comments_controller_1 = require("../controllers/comments.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ УБИРАЕМ GET — он не нужен, комментарии приходят из articles
router.post('/', auth_middleware_1.requireAuth, comments_controller_1.createComment);
exports.default = router;
//# sourceMappingURL=comments.routes.js.map