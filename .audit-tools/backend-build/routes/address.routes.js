"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const addressSuggestions_service_1 = require("../services/addressSuggestions.service");
const router = (0, express_1.Router)();
const requestSchema = zod_1.z.object({ query: zod_1.z.string().trim().min(3).max(200) });
const suggestionsLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'ADDRESS_RATE_LIMITED', error: 'Подсказки временно недоступны' },
});
router.post('/suggestions', auth_middleware_1.requireAuth, suggestionsLimiter, async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ code: 'INVALID_ADDRESS_QUERY', error: 'Введите не менее трёх символов' });
        return;
    }
    try {
        const suggestions = await (0, addressSuggestions_service_1.getAddressSuggestions)(parsed.data.query);
        res.json({ suggestions });
    }
    catch {
        res.status(503).json({ code: 'ADDRESS_SUGGESTIONS_UNAVAILABLE', error: 'Подсказки временно недоступны' });
    }
});
exports.default = router;
//# sourceMappingURL=address.routes.js.map