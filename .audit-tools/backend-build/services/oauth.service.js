"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYandexAuthUrl = getYandexAuthUrl;
exports.handleYandexCallback = handleYandexCallback;
// backend/src/services/oauth.service.ts
const axios_1 = __importDefault(require("axios"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_service_1 = require("./auth.service");
const pendingOAuth_service_1 = require("./pendingOAuth.service");
const prisma_1 = require("../config/prisma");
// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================
const YANDEX_CONFIG = {
    clientId: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    redirectUri: process.env.YANDEX_REDIRECT_URI,
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    userInfoUrl: 'https://login.yandex.ru/info',
};
// ============================================================
// ЯНДЕКС
// ============================================================
function getYandexAuthUrl(state) {
    const params = new URLSearchParams({
        client_id: YANDEX_CONFIG.clientId,
        redirect_uri: YANDEX_CONFIG.redirectUri,
        response_type: 'code',
        scope: 'login:email login:info',
        state,
    });
    return `${YANDEX_CONFIG.authUrl}?${params.toString()}`;
}
async function handleYandexCallback(code, guestId, redirect) {
    try {
        // 1. Получаем токен доступа
        const tokenResponse = await axios_1.default.post(YANDEX_CONFIG.tokenUrl, new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: YANDEX_CONFIG.clientId,
            client_secret: YANDEX_CONFIG.clientSecret,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000,
        });
        const { access_token } = tokenResponse.data;
        // 2. Получаем данные пользователя
        const userInfo = await axios_1.default.get(YANDEX_CONFIG.userInfoUrl, {
            params: { format: 'json' },
            headers: { Authorization: `OAuth ${access_token}` },
            timeout: 10000,
        });
        const { id: yandexId, default_email: email, first_name, last_name } = userInfo.data;
        if (typeof email !== 'string' || typeof yandexId !== 'string' || !yandexId) {
            throw new Error('Не удалось получить email от Яндекса');
        }
        const normalizedEmail = email.trim().toLowerCase();
        // 3. Ищем или создаём пользователя
        let user = await prisma_1.prisma.user.findUnique({ where: { yandexId } });
        if (!user) {
            const emailOwner = await prisma_1.prisma.user.findFirst({
                where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            });
            if (emailOwner)
                throw new Error('OAUTH_LINK_REQUIRED');
            const pendingToken = await (0, pendingOAuth_service_1.issuePendingOAuth)({ provider: 'yandex', providerId: yandexId,
                email: normalizedEmail, firstName: first_name || '', lastName: last_name || '' }, guestId, redirect);
            return { pendingToken };
        }
        if (user.blockedAt)
            throw new Error('OAUTH_ACCOUNT_UNAVAILABLE');
        // ✅ 4. ПЕРЕНОС КОРЗИНЫ (если есть guestId)
        const cartMerged = guestId ? await (0, auth_controller_1.mergeCart)(user.id, guestId) : true;
        // 5. Генерируем JWT
        const token = await (0, auth_service_1.generateToken)(user.id);
        return { user, token, cartMerged };
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=oauth.service.js.map