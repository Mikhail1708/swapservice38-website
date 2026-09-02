// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { 
  registerSchema, 
  loginSchema, 
  verifySchema,
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

const router = Router();
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
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
const oauthCallbackUrl = (redirect: string, errorCode?: string) => {
  const url = new URL('/oauth-callback', process.env.CLIENT_URL);
  url.searchParams.set('redirect', safeOAuthRedirect(redirect));
  if (errorCode) url.searchParams.set('error', errorCode);
  return url.toString();
};

// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ (С ВАЛИДАЦИЕЙ)
// ============================================================

router.post('/register', verificationLimiter, validate(registerSchema), registerController);
router.post('/verify', verificationLimiter, validate(verifySchema), verifyController);
router.post('/resend-verification', verificationLimiter, validate(resetPasswordRequestSchema), resendVerificationController);
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
    const { token, cartMerged } = await oauthService.handleYandexCallback(code as string, guestId);

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
    log.error('Yandex OAuth callback error', { error: error.message });
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
    const { token, cartMerged } = await oauthService.handleMaxCallback(code as string, guestId);

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
    log.error('MAX OAuth callback error', { error: error.message });
    res.redirect(oauthFailureUrl(error.message === 'OAUTH_LINK_REQUIRED' ? 'oauth_link_required' : 'oauth_failed'));
  }
});

export default router;
