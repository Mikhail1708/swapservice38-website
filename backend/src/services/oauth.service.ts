// backend/src/services/oauth.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { mergeCart } from '../controllers/auth.controller';
import { generateToken } from './auth.service';
import { issuePendingOAuth } from './pendingOAuth.service';

const prisma = new PrismaClient();

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const YANDEX_CONFIG = {
  clientId: process.env.YANDEX_CLIENT_ID!,
  clientSecret: process.env.YANDEX_CLIENT_SECRET!,
  redirectUri: process.env.YANDEX_REDIRECT_URI!,
  authUrl: 'https://oauth.yandex.ru/authorize',
  tokenUrl: 'https://oauth.yandex.ru/token',
  userInfoUrl: 'https://login.yandex.ru/info',
};

const MAX_CONFIG = {
  clientId: process.env.MAX_CLIENT_ID!,
  clientSecret: process.env.MAX_CLIENT_SECRET!,
  redirectUri: process.env.MAX_REDIRECT_URI!,
  authUrl: 'https://auth.max.ru/oauth2/authorize',
  tokenUrl: 'https://auth.max.ru/oauth2/token',
  userInfoUrl: 'https://api.max.ru/v1/userinfo',
};

// ============================================================
// ЯНДЕКС
// ============================================================

export function getYandexAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: YANDEX_CONFIG.clientId,
    redirect_uri: YANDEX_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'login:email login:info',
    state,
  });
  return `${YANDEX_CONFIG.authUrl}?${params.toString()}`;
}

export async function handleYandexCallback(code: string, guestId?: string, redirect?: string) {
  try {
    // 1. Получаем токен доступа
    const tokenResponse = await axios.post(
      YANDEX_CONFIG.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: YANDEX_CONFIG.clientId,
        client_secret: YANDEX_CONFIG.clientSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Получаем данные пользователя
    const userInfo = await axios.get(YANDEX_CONFIG.userInfoUrl, {
      params: { format: 'json' },
      headers: { Authorization: `OAuth ${access_token}` },
      timeout: 10_000,
    });

    const { id: yandexId, default_email: email, first_name, last_name } = userInfo.data;
    if (typeof email !== 'string' || typeof yandexId !== 'string' || !yandexId) {
      throw new Error('Не удалось получить email от Яндекса');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Ищем или создаём пользователя
    let user = await prisma.user.findUnique({ where: { yandexId } });

    if (!user) {
      const emailOwner = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });
      if (emailOwner) throw new Error('OAUTH_LINK_REQUIRED');
      const pendingToken = await issuePendingOAuth({ provider: 'yandex', providerId: yandexId,
        email: normalizedEmail, firstName: first_name || '', lastName: last_name || '' }, guestId, redirect);
      return { pendingToken };
    }
    if (user.blockedAt) throw new Error('OAUTH_ACCOUNT_UNAVAILABLE');

    // ✅ 4. ПЕРЕНОС КОРЗИНЫ (если есть guestId)
    const cartMerged = guestId ? await mergeCart(user.id, guestId) : true;

    // 5. Генерируем JWT
    const token = await generateToken(user.id);

    return { user, token, cartMerged };
  } catch (error: any) {
    throw error;
  }
}

// ============================================================
// MAX
// ============================================================

export function getMaxAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MAX_CONFIG.clientId,
    redirect_uri: MAX_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'email profile phone',
    state,
  });
  return `${MAX_CONFIG.authUrl}?${params.toString()}`;
}

export async function handleMaxCallback(code: string, guestId?: string, redirect?: string) {
  try {
    // 1. Получаем токен доступа
    const tokenResponse = await axios.post(
      MAX_CONFIG.tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        client_id: MAX_CONFIG.clientId,
        client_secret: MAX_CONFIG.clientSecret,
        redirect_uri: MAX_CONFIG.redirectUri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Получаем данные пользователя
    const userInfo = await axios.get(MAX_CONFIG.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      timeout: 10_000,
    });

    const {
      sub: maxId,
      email,
      given_name: firstName,
      family_name: lastName,
      phone_number: phone,
      email_verified,
    } = userInfo.data;
    
    if (typeof email !== 'string' || email_verified !== true || typeof maxId !== 'string' || !maxId) {
      throw new Error('Не удалось получить email от MAX');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Ищем или создаём пользователя
    let user = await prisma.user.findUnique({ where: { maxId } });
    if (user?.blockedAt) throw new Error('OAUTH_ACCOUNT_UNAVAILABLE');

    if (!user) {
      const emailOwner = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });
      if (emailOwner) throw new Error('OAUTH_LINK_REQUIRED');
      const pendingToken = await issuePendingOAuth({ provider: 'max', providerId: maxId,
        email: normalizedEmail, firstName: firstName || '', lastName: lastName || '', phone: phone || null }, guestId, redirect);
      return { pendingToken };
    } else {
      // Обновляем данные
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: firstName || user.firstName || '',
          lastName: lastName || user.lastName || '',
          phone: phone || user.phone || null,
        },
      });
    }
    if (user.blockedAt) throw new Error('OAUTH_ACCOUNT_UNAVAILABLE');

    // ✅ 4. ПЕРЕНОС КОРЗИНЫ (если есть guestId)
    const cartMerged = guestId ? await mergeCart(user.id, guestId) : true;

    // 5. Генерируем JWT
    const token = await generateToken(user.id);

    return { user, token, cartMerged };
  } catch (error: any) {
    throw error;
  }
}
