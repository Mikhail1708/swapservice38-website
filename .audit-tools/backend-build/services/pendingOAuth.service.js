"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safePendingRedirect = void 0;
exports.issuePendingOAuth = issuePendingOAuth;
exports.readPendingOAuth = readPendingOAuth;
exports.completePendingOAuth = completePendingOAuth;
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const redis_1 = __importDefault(require("../config/redis"));
const error_middleware_1 = require("../middleware/error.middleware");
const consent_service_1 = require("./consent.service");
const prisma_1 = require("../config/prisma");
const profileSchema = zod_1.z.object({
    provider: zod_1.z.literal('yandex'), providerId: zod_1.z.string().min(1).max(200),
    email: zod_1.z.string().email().max(254), firstName: zod_1.z.string().max(200), lastName: zod_1.z.string().max(200),
    phone: zod_1.z.string().max(50).nullable().optional(),
});
const pendingSchema = zod_1.z.object({ profile: profileSchema, redirect: zod_1.z.string(), guestId: zod_1.z.string().optional() });
const invalid = () => new error_middleware_1.AppError('Сеанс регистрации недействителен или истёк. Повторите вход через сервис', 400, 'OAUTH_PENDING_INVALID');
const keyFor = (token) => {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
        throw invalid();
    return `oauth:pending-registration:v1:${(0, crypto_1.createHash)('sha256').update(token).digest('hex')}`;
};
const safePendingRedirect = (value) => typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020\u007f]/.test(value) ? value : '/';
exports.safePendingRedirect = safePendingRedirect;
// Only provider-verified data reaches this function. No access/refresh token is retained.
async function issuePendingOAuth(profile, guestId, redirect) {
    const verified = profileSchema.parse(profile);
    const token = (0, crypto_1.randomBytes)(32).toString('base64url');
    await redis_1.default.set(keyFor(token), JSON.stringify({ profile: verified, guestId, redirect: (0, exports.safePendingRedirect)(redirect) }), 'EX', 600);
    return token;
}
async function readPendingOAuth(token) {
    const value = await redis_1.default.get(keyFor(token));
    if (!value)
        throw invalid();
    const parsed = pendingSchema.safeParse(JSON.parse(value));
    if (!parsed.success)
        throw invalid();
    return parsed.data;
}
async function completePendingOAuth(token, acceptance) {
    const evidence = (0, consent_service_1.personalDataEvidence)(acceptance, 'registration');
    // Atomic consume before DB effects: concurrent requests and retries cannot replay identity.
    // On a DB failure restart OAuth; never restore a consumed credential.
    const value = await redis_1.default.eval("local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v", 1, keyFor(token));
    if (typeof value !== 'string')
        throw invalid();
    const parsed = pendingSchema.safeParse(JSON.parse(value));
    if (!parsed.success)
        throw invalid();
    const { profile, redirect, guestId } = parsed.data;
    const identity = { yandexId: profile.providerId };
    try {
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            const existing = await tx.user.findFirst({ where: { OR: [identity, { email: { equals: profile.email, mode: 'insensitive' } }] } });
            if (existing)
                throw new error_middleware_1.AppError('Аккаунт уже существует. Повторите вход', 409, 'OAUTH_ACCOUNT_EXISTS');
            return tx.user.create({ data: {
                    ...identity, email: profile.email, firstName: profile.firstName, lastName: profile.lastName,
                    phone: profile.phone || null, isVerified: true, role: 'user', consents: { create: evidence },
                } });
        }, { isolationLevel: 'Serializable' });
        return { user, redirect: (0, exports.safePendingRedirect)(redirect), guestId };
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        throw new error_middleware_1.AppError('Не удалось завершить регистрацию. Повторите вход через сервис', 409, 'OAUTH_REGISTRATION_FAILED');
    }
}
//# sourceMappingURL=pendingOAuth.service.js.map