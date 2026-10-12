"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const services_controller_1 = require("../controllers/services.controller");
const router = (0, express_1.Router)();
router.get('/', services_controller_1.getPublicServices);
router.get('/:id', services_controller_1.getPublicServiceById);
exports.default = router;
//# sourceMappingURL=services.routes.js.map