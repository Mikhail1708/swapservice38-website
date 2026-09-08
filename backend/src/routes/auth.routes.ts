// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { 
  registerSchema, 
  loginSchema, 
  verifySchema,
  verificationContextSchema,
  resendVerificationSchema,
  changePasswordSchema,
  resetPasswordRequestSchema,
  resetPasswordVerifySchema,
  resetPasswordConfirmSchema,
  updateProfileSchema
} from '../schemas/auth.schema';
import {
  registerController,
  verifyController,
  loginController,
  logoutController,
  meController,
  updateProfileController,
  changePasswordController,
  requestPasswordChangeController,
  confirmPasswordChangeController,
  requestPasswordResetController,
  verifyResetCodeController,
  confirmResetPasswordController,
  resendVerificationController,
  verificationContextController,
  consentStatusController,
  consentDocumentsController,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import {
  passwordResetAttemptLimiter,
  passwordResetRequestLimiter,
} from '../middleware/passwordResetLimiter.middleware';
import * as oauthService from '../services/oauth.service';
import { log } from '../config/logger';
import { authLimiter, verificationLimiter } from '../middleware/rateLimiter.middleware';
import { randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { CONSENT_DOCUMENTS, personalDataAcceptanceSchema } from '../services/consent.service';
import { completePendingOAuth, readPendingOAuth, safePendingRedirect } from '../services/pendingOAuth.service';
import { generateToken } from '../services/auth.service';
import { mergeCart } from '../controllers/auth.controller';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.get('/consent-documents', consentDocumentsController);
router.get('/consent-status', requireAuth, consentStatusController);
const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60 * 1000,
  path: '/api/auth',
};
const createOAuthState = () => randomBytes(32).toString('base64url');
const validOAuthState = (received: unknown, stored: unknown): boolean => {
  if (typeof received !== 'string' || typeof stored !== 'string') return false;
  const left = Buffer.from(received);
  const right = Buffer.from(stored);
  return left.length === right.length && timingSafeEqual(left, right);
};
const oauthFailureUrl = (code = 'oauth_failed') =>
  `${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent(code)}`;
const safeOAuthRedirect = (value: unknown): string =>
  safePendingRedirect(value);
const oauthCallbackUrl = (redirect: string, errorCode?: string) => {
  const url = new URL('/oauth-callback', process.env.CLIENT_URL);
  url.searchParams.set('redirect', safeOAuthRedirect(redirect));
  if (errorCode) url.searchParams.set('error', errorCode);
  return url.toString();
};

// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ (С ВАЛИДАЦИЕЙ)
// ============================================================

router.get('/oauth/consent', verificationLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const pending = await readPendingOAuth(req.cookies?.oauth_pending);
    res.json({ provider: pending.profile.provider, documents: CONSENT_DOCUMENTS });
  } catch (error) {
    const known = error instanceof AppError;
    res.status(known ? error.statusCode : 503).json({ error: known ? error.message : 'Регистрация временно недоступна', code: known ? error.code : 'OAUTH_UNAVAILABLE' });
  }
});
// Global CSRF middleware protects this POST; it is not an OAuth callback exemption.
router.post('/oauth/consent', verificationLimiter,
  validate(z.object({ personalDataConsent: personalDataAcceptanceSchema }).strict()), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const completed = await completePendingOAuth(req.cookies?.oauth_pending, req.body.personalDataConsent);
      res.clearCookie('oauth_pending', { ...oauthCookieOptions, maxAge: undefined });
      const cartMerged = completed.guestId ? await mergeCart(completed.user.id, completed.guestId) : true;
      if (completed.guestId && cartMerged) res.clearCookie('guestId', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      const token = await generateToken(completed.user.id);
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
      res.json({ redirect: completed.redirect });
    } catch (error) {
      const known = error instanceof AppError;
      res.status(known ? error.statusCode : 503).json({ error: known ? error.message : 'Не удалось завершить регистрацию. Повторите вход через сервис', code: known ? error.code : 'OAUTH_UNAVAILABLE' });
    }
  });

router.post('/register', verificationLimiter, validate(registerSchema), registerController);
router.post('/verify', verificationLimiter, validate(verifySchema), verifyController);
router.post('/resend-verification', verificationLimiter, validate(resendVerificationSchema), resendVerificationController);
router.post('/verification-context', verificationLimiter, validate(verificationContextSchema), verificationContextController);
router.post('/login', authLimiter, validate(loginSchema), loginController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, meController);

// ============================================================
// ПРОФИЛЬ (С ВАЛИДАЦИЕЙ)
// ============================================================

router.put('/profile', requireAuth, validate(updateProfileSchema), updateProfileController);

// ============================================================
// СМЕНА ПАРОЛЯ (ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ, С ВАЛИДАЦИЕЙ)
// ============================================================

router.post('/change-password', requireAuth, validate(changePasswordSchema), changePasswordController);
router.post('/request-password-change', requireAuth, requestPasswordChangeController);
router.post('/confirm-password-change', requireAuth, confirmPasswordChangeController);

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ ЭНДПОИНТЫ, С ВАЛИДАЦИЕЙ)
// ============================================================

router.post('/reset-password/request', passwordResetRequestLimiter, validate(resetPasswordRequestSchema), requestPasswordResetController);
router.post('/reset-password/verify', passwordResetAttemptLimiter, validate(resetPasswordVerifySchema), verifyResetCodeController);
router.post('/reset-password/confirm', passwordResetAttemptLimiter, validate(resetPasswordConfirmSchema), confirmResetPasswordController);

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
  } catch (error: any) {
    log.error('Yandex OAuth redirect error', { error: error.message });
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
    const result = await oauthService.handleYandexCallback(code as string, guestId, oauthRedirect);
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
  } catch (error: any) {
    log.error('Yandex OAuth callback error', { errorName: error?.name || 'Error' });
    res.redirect(oauthFailureUrl(error.message === 'OAUTH_LINK_REQUIRED' ? 'oauth_link_required' : 'oauth_failed'));
  }
});

// ============================================================
// OAuth: MAX (БЕЗ ВАЛИДАЦИИ — ПЕРЕНАПРАВЛЕНИЕ)
// ============================================================

router.get('/max', (req, res) => {
  try {
    const state = createOAuthState();
    res.cookie('oauth_state', state, oauthCookieOptions);
    res.cookie('oauth_redirect', safeOAuthRedirect(req.query.redirect), oauthCookieOptions);
    const url = oauthService.getMaxAuthUrl(state);
    res.redirect(url);
  } catch (error: any) {
    log.error('MAX OAuth redirect error', { error: error.message });
    res.redirect(oauthFailureUrl());
  }
});

router.get('/max/callback', async (req, res) => {
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
    const result = await oauthService.handleMaxCallback(code as string, guestId, oauthRedirect);
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
  } catch (error: any) {
    log.error('MAX OAuth callback error', { errorName: error?.name || 'Error' });
    res.redirect(oauthFailureUrl(error.message === 'OAUTH_LINK_REQUIRED' ? 'oauth_link_required' : 'oauth_failed'));
  }
});

export default router;
