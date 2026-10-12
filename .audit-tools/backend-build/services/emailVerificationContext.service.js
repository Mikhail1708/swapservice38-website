"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskVerificationEmail = exports.resolveVerificationContext = exports.createVerificationContext = void 0;
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../config/redis"));
const error_middleware_1 = require("../middleware/error.middleware");
// This opaque capability identifies a verification, but never replaces its code
// or grants a session. Keep it usable for resend after the 10-minute code TTL.
const CONTEXT_TTL = 24 * 60 * 60;
const contextKey = (token) => `email-verification-context:${(0, crypto_1.createHash)('sha256').update(token).digest('hex')}`;
const createVerificationContext = async (userId) => {
    const token = (0, crypto_1.randomBytes)(32).toString('base64url');
    await redis_1.default.setex(contextKey(token), CONTEXT_TTL, userId);
    return token;
};
exports.createVerificationContext = createVerificationContext;
const resolveVerificationContext = async (token) => {
    const userId = /^[A-Za-z0-9_-]{43}$/.test(token)
        ? await redis_1.default.get(contextKey(token))
        : null;
    if (!userId)
        throw new error_middleware_1.AppError('Ссылка недействительна или срок её действия истёк. Запросите новое письмо.', 400, 'VERIFICATION_LINK_INVALID');
    return userId;
};
exports.resolveVerificationContext = resolveVerificationContext;
const maskVerificationEmail = (email) => {
    const [local, domain] = email.split('@');
    return local && domain ? `${local.slice(0, 2)}***@${domain}` : '***';
};
exports.maskVerificationEmail = maskVerificationEmail;
//# sourceMappingURL=emailVerificationContext.service.js.map