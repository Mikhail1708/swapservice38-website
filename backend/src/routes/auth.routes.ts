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

const router = Router();

// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ (С ВАЛИДАЦИЕЙ)
// ============================================================

router.post('/register', validate(registerSchema), registerController);
router.post('/verify', validate(verifySchema), verifyController);
router.post('/resend-verification', validate(resetPasswordRequestSchema), resendVerificationController);
router.post('/login', validate(loginSchema), loginController);
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
    const url = oauthService.getYandexAuthUrl();
    res.redirect(url);
  } catch (error: any) {
    log.error('Yandex OAuth redirect error', { error: error.message });
    res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Ошибка входа через Яндекс')}`);
  }
});

router.get('/yandex/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      const message = typeof error === 'string' ? error : 'Ошибка авторизации';
      return res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent(message)}`);
    }

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent('Не получен код авторизации')}`);
    }

    const guestId = req.cookies?.guestId;
    log.info('OAuth callback', { guestId: guestId || 'нет' });

    const { token } = await oauthService.handleYandexCallback(code as string, guestId);

    if (guestId) {
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
    });

    log.info('OAuth успешен, редирект', { url: `${process.env.CLIENT_URL}/oauth-callback` });
    res.redirect(`${process.env.CLIENT_URL}/oauth-callback`);
  } catch (error: any) {
    log.error('Yandex OAuth callback error', { error: error.message });
    const message = encodeURIComponent(error.message || 'Ошибка входа через Яндекс');
    res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${message}`);
  }
});

// ============================================================
// OAuth: MAX (БЕЗ ВАЛИДАЦИИ — ПЕРЕНАПРАВЛЕНИЕ)
// ============================================================

router.get('/max', (req, res) => {
  try {
    const url = oauthService.getMaxAuthUrl();
    res.redirect(url);
  } catch (error: any) {
    log.error('MAX OAuth redirect error', { error: error.message });
    res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Ошибка входа через MAX')}`);
  }
});

router.get('/max/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      const message = typeof error === 'string' ? error : 'Ошибка авторизации';
      return res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent(message)}`);
    }

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${encodeURIComponent('Не получен код авторизации')}`);
    }

    const guestId = req.cookies?.guestId;
    log.info('OAuth callback MAX', { guestId: guestId || 'нет' });

    const { token } = await oauthService.handleMaxCallback(code as string, guestId);

    if (guestId) {
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
    });

    log.info('OAuth MAX успешен, редирект', { url: `${process.env.CLIENT_URL}/oauth-callback` });
    res.redirect(`${process.env.CLIENT_URL}/oauth-callback`);
  } catch (error: any) {
    log.error('MAX OAuth callback error', { error: error.message });
    const message = encodeURIComponent(error.message || 'Ошибка входа через MAX');
    res.redirect(`${process.env.CLIENT_URL}/oauth-callback?error=${message}`);
  }
});

export default router;
