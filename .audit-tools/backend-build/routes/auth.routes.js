"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/auth.routes.ts
const express_1 = require("express");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_schema_1 = require("../schemas/auth.schema");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const passwordResetLimiter_middleware_1 = require("../middleware/passwordResetLimiter.middleware");
const oauthService = __importStar(require("../services/oauth.service"));
const logger_1 = require("../config/logger");
const rateLimiter_middleware_1 = require("../middleware/rateLimiter.middleware");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const consent_service_1 = require("../services/consent.service");
const pendingOAuth_service_1 = require("../services/pendingOAuth.service");
const auth_service_1 = require("../services/auth.service");
const auth_controller_2 = require("../controllers/auth.controller");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.get('/consent-documents', auth_controller_1.consentDocumentsController);
router.get('/consent-status', auth_middleware_1.requireAuth, auth_controller_1.consentStatusController);
const oauthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth',
};
const createOAuthState = () => (0, crypto_1.randomBytes)(32).toString('base64url');
const validOAuthState = (received, stored) => {
    if (typeof received !== 'string' || typeof stored !== 'string')
        return false;
    const left = Buffer.from(received);
    const right = Buffer.from(stored);
    return left.length === right.length && (0, crypto_1.timingSafeEqual)(left, right);
};
const oauthFailureUrl = (code = 'oauth_failed') => `${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent(code)}`;
const safeOAuthRedirect = (value) => (0, pendingOAuth_service_1.safePendingRedirect)(value);
const oauthCallbackUrl = (redirect, errorCode) => {
    const url = new URL('/oauth-callback', process.env.CLIENT_URL);
    url.searchParams.set('redirect', safeOAuthRedirect(redirect));
    if (errorCode)
        url.searchParams.set('error', errorCode);
    return url.toString();
};
// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ (С ВАЛИДАЦИЕЙ)
// ============================================================
router.get('/oauth/consent', rateLimiter_middleware_1.verificationLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const pending = await (0, pendingOAuth_service_1.readPendingOAuth)(req.cookies?.oauth_pending);
        res.json({ provider: pending.profile.provider, documents: consent_service_1.CONSENT_DOCUMENTS });
    }
    catch (error) {
        const known = error instanceof error_middleware_1.AppError;
        res.status(known ? error.statusCode : 503).json({ error: known ? error.message : 'Регистрация временно недоступна', code: known ? error.code : 'OAUTH_UNAVAILABLE' });
    }
});
// Global CSRF middleware protects this POST; it is not an OAuth callback exemption.
router.post('/oauth/consent', rateLimiter_middleware_1.verificationLimiter, (0, validate_middleware_1.validate)(zod_1.z.object({ personalDataConsent: consent_service_1.personalDataAcceptanceSchema }).strict()), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const completed = await (0, pendingOAuth_service_1.completePendingOAuth)(req.cookies?.oauth_pending, req.body.personalDataConsent);
        res.clearCookie('oauth_pending', { ...oauthCookieOptions, maxAge: undefined });
        const cartMerged = completed.guestId ? await (0, auth_controller_2.mergeCart)(completed.user.id, completed.guestId) : true;
        if (completed.guestId && cartMerged)
            res.clearCookie('guestId', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
        const token = await (0, auth_service_1.generateToken)(completed.user.id);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
        res.json({ redirect: completed.redirect });
    }
    catch (error) {
        const known = error instanceof error_middleware_1.AppError;
        res.status(known ? error.statusCode : 503).json({ error: known ? error.message : 'Не удалось завершить регистрацию. Повторите вход через сервис', code: known ? error.code : 'OAUTH_UNAVAILABLE' });
    }
});
router.post('/register', rateLimiter_middleware_1.verificationLimiter, (0, validate_middleware_1.validate)(auth_schema_1.registerSchema), auth_controller_1.registerController);
router.post('/verify', rateLimiter_middleware_1.verificationLimiter, (0, validate_middleware_1.validate)(auth_schema_1.verifySchema), auth_controller_1.verifyController);
router.post('/resend-verification', rateLimiter_middleware_1.verificationLimiter, (0, validate_middleware_1.validate)(auth_schema_1.resendVerificationSchema), auth_controller_1.resendVerificationController);
router.post('/verification-context', rateLimiter_middleware_1.verificationLimiter, (0, validate_middleware_1.validate)(auth_schema_1.verificationContextSchema), auth_controller_1.verificationContextController);
router.post('/login', rateLimiter_middleware_1.authLimiter, (0, validate_middleware_1.validate)(auth_schema_1.loginSchema), auth_controller_1.loginController);
router.post('/logout', auth_controller_1.logoutController);
router.get('/me', auth_middleware_1.requireAuth, auth_controller_1.meController);
// ============================================================
// ПРОФИЛЬ (С ВАЛИДАЦИЕЙ)
// ============================================================
router.put('/profile', auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(auth_schema_1.updateProfileSchema), auth_controller_1.updateProfileController);
// ============================================================
// СМЕНА ПАРОЛЯ (ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ, С ВАЛИДАЦИЕЙ)
// ============================================================
router.post('/change-password', auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(auth_schema_1.changePasswordSchema), auth_controller_1.changePasswordController);
router.post('/request-password-change', auth_middleware_1.requireAuth, auth_controller_1.requestPasswordChangeController);
router.post('/confirm-password-change', auth_middleware_1.requireAuth, auth_controller_1.confirmPasswordChangeController);
// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ ЭНДПОИНТЫ, С ВАЛИДАЦИЕЙ)
// ============================================================
router.post('/reset-password/request', passwordResetLimiter_middleware_1.passwordResetRequestLimiter, (0, validate_middleware_1.validate)(auth_schema_1.resetPasswordRequestSchema), auth_controller_1.requestPasswordResetController);
router.post('/reset-password/verify', passwordResetLimiter_middleware_1.passwordResetAttemptLimiter, (0, validate_middleware_1.validate)(auth_schema_1.resetPasswordVerifySchema), auth_controller_1.verifyResetCodeController);
router.post('/reset-password/confirm', passwordResetLimiter_middleware_1.passwordResetAttemptLimiter, (0, validate_middleware_1.validate)(auth_schema_1.resetPasswordConfirmSchema), auth_controller_1.confirmResetPasswordController);
// ============================================================
// OAuth: ЯНДЕКС (БЕЗ ВАЛИДАЦИИ — ПЕРЕНАПРАВЛЕНИЕ)
// ============================================================
router.get('/yandex', (req, res) => {
    try {
        const state = createOAuthState();
        res.cookie('oauth_state', state, oauthCookieOptions);
        res.cookie('oauth_redirect', safeOAuthRedirect(req.query.redirect), oauthCookieOptions);
        const url = oauthService.getYandexAuthUrl(state);
        res.redirect(url);
    }
    catch (error) {
        logger_1.log.error('Yandex OAuth redirect error', { error: error.message });
        res.redirect(oauthFailureUrl());
    }
});
router.get('/yandex/callback', async (req, res) => {
    try {
        const { code, error, state } = req.query;
        if (!validOAuthState(state, req.cookies?.oauth_state)) {
            res.clearCookie('oauth_state', { ...oauthCookieOptions, maxAge: undefined });
            res.clearCookie('oauth_redirect', { ...oauthCookieOptions, maxAge: undefined });
            return res.redirect(oauthFailureUrl());
        }
        const oauthRedirect = safeOAuthRedirect(req.cookies?.oauth_redirect);
        res.clearCookie('oauth_state', { ...oauthCookieOptions, maxAge: undefined });
        res.clearCookie('oauth_redirect', { ...oauthCookieOptions, maxAge: undefined });
        if (error) {
            return res.redirect(oauthCallbackUrl(oauthRedirect, 'oauth_denied'));
        }
        if (!code) {
            return res.redirect(oauthFailureUrl());
        }
        const guestId = req.cookies?.guestId;
        const result = await oauthService.handleYandexCallback(code, guestId, oauthRedirect);
        if (result.pendingToken) {
            res.cookie('oauth_pending', result.pendingToken, oauthCookieOptions);
            return res.redirect(new URL('/oauth-consent', process.env.CLIENT_URL).toString());
        }
        const { token, cartMerged } = result;
        if (guestId && cartMerged) {
            res.clearCookie('guestId', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.redirect(oauthCallbackUrl(oauthRedirect));
    }
    catch (error) {
        logger_1.log.error('Yandex OAuth callback error', { errorName: error?.name || 'Error' });
        res.redirect(oauthFailureUrl(error.message === 'OAUTH_LINK_REQUIRED' ? 'oauth_link_required' : 'oauth_failed'));
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map