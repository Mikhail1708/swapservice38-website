// backend/src/middleware/csrf.middleware.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================================
// ХРАНИЛИЩЕ ТОКЕНОВ
// ============================================================
const tokenStore = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL = 5 * 60 * 1000; // 5 минут

// Очистка просроченных токенов
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenStore) {
    if (now > entry.expiresAt) {
      tokenStore.delete(key);
    }
  }
}, 60000);

// ============================================================
// ГЕНЕРАЦИЯ ТОКЕНА
// ============================================================
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

// ============================================================
// ПОЛУЧЕНИЕ ID СЕССИИ
// ============================================================
const getSessionId = (req: Request): string => {
  return req.cookies?.sessionId || req.ip || 'default';
};

// ============================================================
// ПУБЛИЧНЫЕ ПУТИ (БЕЗ CSRF)
// ============================================================
const PUBLIC_PATHS = [
  '/api/webhooks',
  '/api/payment/webhook',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/reset-password',
  '/api/auth/request-password-change',
  '/api/auth/confirm-password-change',
  '/api/auth/yandex',
  '/api/auth/yandex/callback',
  '/api/auth/max',
  '/api/auth/max/callback',
  '/api/products',
  '/api/products/categories',
  '/api/health',
  '/api/csrf-token',
];

const isPublicPath = (path: string): boolean => {
  return PUBLIC_PATHS.some(p => path.startsWith(p));
};

// ============================================================
// MIDDLEWARE
// ============================================================
export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
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

  console.log('🔍 CSRF токен:', {
    header: token ? token.substring(0, 10) + '...' : undefined,
    body: req.body?._csrf ? req.body._csrf.substring(0, 10) + '...' : undefined,
  });

  if (!token) {
    console.error('❌ CSRF токен отсутствует');
    return res.status(403).json({
      error: 'CSRF токен отсутствует',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  const sessionId = getSessionId(req);
  
  // ✅ ИЩЕМ ТОКЕН ПО СЕССИИ (без привязки к конкретному токену)
  let foundKey: string | null = null;
  let foundEntry: { token: string; expiresAt: number } | null = null;

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
    if (foundKey) tokenStore.delete(foundKey);
    return res.status(403).json({
      error: 'CSRF токен просрочен',
      code: 'CSRF_TOKEN_EXPIRED'
    });
  }

  // ✅ НЕ УДАЛЯЕМ ТОКЕН — ОСТАВЛЯЕМ ДЛЯ ПОВТОРНЫХ ЗАПРОСОВ
  console.log('✅ CSRF токен валиден (оставляем для повторных запросов)');

  next();
};

// ============================================================
// ПОЛУЧЕНИЕ CSRF ТОКЕНА
// ============================================================
export const getCsrfToken = (req: Request, res: Response) => {
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

    console.log('✅ CSRF токен сгенерирован:', token.substring(0, 10) + '...');
    res.json({ csrfToken: token });
  } catch (error) {
    console.error('❌ Ошибка генерации CSRF токена:', error);
    res.status(500).json({
      error: 'Ошибка генерации CSRF токена',
      csrfToken: null
    });
  }
};

export default csrfMiddleware;