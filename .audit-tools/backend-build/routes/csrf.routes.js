"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/csrf.routes.ts
const express_1 = require("express");
const csrf_middleware_1 = require("../middleware/csrf.middleware");
const router = (0, express_1.Router)();
// GET /api/csrf-token — получить CSRF токен
router.get('/', csrf_middleware_1.getCsrfToken);
exports.default = router;
//# sourceMappingURL=csrf.routes.js.map