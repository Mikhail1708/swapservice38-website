// backend/src/routes/auth.routes.ts
import { Router } from 'express';
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
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import * as oauthService from '../services/oauth.service';

const router = Router();

// ============================================================
// СТАНДАРТНАЯ АУТЕНТИФИКАЦИЯ
// ============================================================

router.post('/register', registerController);
router.post('/verify', verifyController);
router.post('/login', loginController);
router.post('/logout', logoutController);
router.get('/me', authMiddleware, meController);

// ============================================================
// ПРОФИЛЬ
// ============================================================

router.put('/profile', authMiddleware, updateProfileController);

// ============================================================
// СМЕНА ПАРОЛЯ (ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ)
// ============================================================

router.post('/change-password', authMiddleware, changePasswordController);
router.post('/request-password-change', authMiddleware, requestPasswordChangeController);
router.post('/confirm-password-change', authMiddleware, confirmPasswordChangeController);

// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ ЭНДПОИНТЫ)
// ============================================================

router.post('/reset-password/request', requestPasswordResetController);
router.post('/reset-password/verify', verifyResetCodeController);
router.post('/reset-password/confirm', confirmResetPasswordController);

// ============================================================
// OAuth: ЯНДЕКС
// ============================================================

router.get('/yandex', (req, res) => {
  try {
    const url = oauthService.getYandexAuthUrl();
    res.redirect(url);
  } catch (error: any) {
    console.error('Yandex OAuth redirect error:', error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Ошибка входа через Яндекс')}`);
  }
});

router.get('/yandex/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      const message = typeof error === 'string' ? error : 'Ошибка авторизации';
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent(message)}`);
    }

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Не получен код авторизации')}`);
    }

    const guestId = req.cookies?.guestId;
    console.log('🍪 guestId в OAuth callback:', guestId || 'нет');

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

    // ✅ РЕДИРЕКТ НА ГЛАВНУЮ СТРАНИЦУ
    res.redirect(`${process.env.CLIENT_URL}/`);
  } catch (error: any) {
    console.error('Yandex OAuth callback error:', error);
    const message = encodeURIComponent(error.message || 'Ошибка входа через Яндекс');
    res.redirect(`${process.env.CLIENT_URL}/login?error=${message}`);
  }
});

// ============================================================
// OAuth: MAX
// ============================================================

router.get('/max', (req, res) => {
  try {
    const url = oauthService.getMaxAuthUrl();
    res.redirect(url);
  } catch (error: any) {
    console.error('MAX OAuth redirect error:', error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Ошибка входа через MAX')}`);
  }
});

router.get('/max/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      const message = typeof error === 'string' ? error : 'Ошибка авторизации';
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent(message)}`);
    }

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent('Не получен код авторизации')}`);
    }

    const guestId = req.cookies?.guestId;
    console.log('🍪 guestId в OAuth callback:', guestId || 'нет');

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

    // ✅ РЕДИРЕКТ НА ГЛАВНУЮ СТРАНИЦУ
    res.redirect(`${process.env.CLIENT_URL}/`);
  } catch (error: any) {
    console.error('MAX OAuth callback error:', error);
    const message = encodeURIComponent(error.message || 'Ошибка входа через MAX');
    res.redirect(`${process.env.CLIENT_URL}/login?error=${message}`);
  }
});

export default router;