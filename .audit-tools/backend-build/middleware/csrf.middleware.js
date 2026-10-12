"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCsrfToken = exports.csrfMiddleware = void 0;
const crypto_1 = __importDefault(require("crypto"));
// ============================================================
// ХРАНИЛИЩЕ ТОКЕНОВ
// ============================================================
const tokenStore = new Map();
const TOKEN_TTL = 5 * 60 * 1000; // 5 минут
// Очистка просроченных токенов
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tokenStore) {
        if (now > entry.expiresAt) {
            tokenStore.delete(key);
        }
    }
}, 60000);
cleanupInterval.unref();
// ============================================================
// ГЕНЕРАЦИЯ ТОКЕНА
// ============================================================
const generateToken = () => {
    return crypto_1.default.randomBytes(32).toString('base64url');
};
// ============================================================
// ПОЛУЧЕНИЕ ID СЕССИИ
// ============================================================
const getSessionId = (req) => {
    return req.cookies?.sessionId || req.ip || 'default';
};
// ============================================================
// ПУБЛИЧНЫЕ ПУТИ (БЕЗ CSRF)
// ============================================================
const PUBLIC_PATHS = new Set([
    '/api/webhooks',
    '/api/payment/webhook',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify',
    '/api/auth/reset-password',
    '/api/auth/yandex',
    '/api/auth/yandex/callback',
]);
const isPublicPath = (path) => {
    return PUBLIC_PATHS.has(path) ||
        path === '/api/webhooks' ||
        path.startsWith('/api/webhooks/');
};
// ============================================================
// MIDDLEWARE
// ============================================================
const csrfMiddleware = (req, res, next) => {
    // Пропускаем публичные пути
    if (isPublicPath(req.path)) {
        return next();
    }
    // Пропускаем GET запросы
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    console.log(`🛡️ CSRF проверка для ${req.method} ${req.path}`);
    // Получаем токен из заголовка или body
    const token = req.headers['x-csrf-token'] ||
        req.headers['csrf-token'] ||
        req.headers['X-CSRF-Token'] ||
        req.body?._csrf;
    if (!token) {
        console.error('❌ CSRF токен отсутствует');
        return res.status(403).json({
            error: 'CSRF токен отсутствует',
            code: 'CSRF_TOKEN_MISSING'
        });
    }
    const sessionId = getSessionId(req);
    // ✅ ИЩЕМ ТОКЕН ПО СЕССИИ (без привязки к конкретному токену)
    let foundKey = null;
    let foundEntry = null;
    for (const [key, entry] of tokenStore) {
        if (key.startsWith(sessionId + ':') && entry.token === token) {
            foundKey = key;
            foundEntry = entry;
            break;
        }
    }
    if (!foundEntry) {
        console.error('❌ CSRF токен не найден в хранилище');
        return res.status(403).json({
            error: 'Неверный CSRF токен',
            code: 'CSRF_TOKEN_INVALID'
        });
    }
    if (Date.now() > foundEntry.expiresAt) {
        console.error('❌ CSRF токен просрочен');
        if (foundKey)
            tokenStore.delete(foundKey);
        return res.status(403).json({
            error: 'CSRF токен просрочен',
            code: 'CSRF_TOKEN_EXPIRED'
        });
    }
    // ✅ НЕ УДАЛЯЕМ ТОКЕН — ОСТАВЛЯЕМ ДЛЯ ПОВТОРНЫХ ЗАПРОСОВ
    console.log('✅ CSRF токен валиден (оставляем для повторных запросов)');
    // _csrf — служебное поле middleware и не должно попадать
    // в последующую бизнес-валидацию body.
    if (req.body && typeof req.body === 'object') {
        delete req.body._csrf;
    }
    next();
};
exports.csrfMiddleware = csrfMiddleware;
// ============================================================
// ПОЛУЧЕНИЕ CSRF ТОКЕНА
// ============================================================
const getCsrfToken = (req, res) => {
    try {
        const token = generateToken();
        const sessionId = getSessionId(req);
        const key = `${sessionId}:${token}`;
        // Сохраняем токен
        tokenStore.set(key, {
            token,
            expiresAt: Date.now() + TOKEN_TTL,
        });
        // Устанавливаем sessionId cookie если его нет
        if (!req.cookies?.sessionId) {
            res.cookie('sessionId', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: TOKEN_TTL,
            });
        }
        res.json({ csrfToken: token });
    }
    catch (error) {
        console.error('❌ Ошибка генерации CSRF токена:', error);
        res.status(500).json({
            error: 'Ошибка генерации CSRF токена',
            csrfToken: null
        });
    }
};
exports.getCsrfToken = getCsrfToken;
exports.default = exports.csrfMiddleware;
//# sourceMappingURL=csrf.middleware.js.map