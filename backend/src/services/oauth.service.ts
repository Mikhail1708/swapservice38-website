// backend/src/services/oauth.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { mergeCart } from '../controllers/auth.controller';

const prisma = new PrismaClient();

// Генерация JWT
const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

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

export function getYandexAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: YANDEX_CONFIG.clientId,
    redirect_uri: YANDEX_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'login:email login:info',
  });
  const url = `${YANDEX_CONFIG.authUrl}?${params.toString()}`;
  console.log('🔑 Yandex auth URL:', url);
  return url;
}

export async function handleYandexCallback(code: string, guestId?: string) {
  console.log('📥 Yandex callback received, code:', code.substring(0, 10) + '...');

  try {
    // 1. Получаем токен доступа
    console.log('🔄 Requesting Yandex token...');
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
      }
    );

    const { access_token } = tokenResponse.data;
    console.log('✅ Yandex token received');

    // 2. Получаем данные пользователя
    console.log('🔄 Requesting Yandex user info...');
    const userInfo = await axios.get(YANDEX_CONFIG.userInfoUrl, {
      params: { format: 'json' },
      headers: { Authorization: `OAuth ${access_token}` },
    });

    const { id: yandexId, default_email: email, first_name, last_name } = userInfo.data;
    console.log('👤 Yandex user:', { yandexId, email, first_name, last_name });

    if (!email) {
      throw new Error('Не удалось получить email от Яндекса');
    }

    // 3. Ищем или создаём пользователя
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ yandexId }, { email }],
      },
    });

    if (!user) {
      console.log('🆕 Creating new user from Yandex');
      user = await prisma.user.create({
        data: {
          email,
          firstName: first_name || '',
          lastName: last_name || '',
          yandexId,
          isVerified: true,
          role: 'user',
        },
      });
      console.log(`✅ Создан пользователь: ${user.id} (${user.email})`);
    } else if (!user.yandexId) {
      console.log('🔗 Linking Yandex to existing user');
      user = await prisma.user.update({
        where: { id: user.id },
        data: { yandexId },
      });
    } else {
      console.log('✅ User already exists with Yandex');
    }

    // ✅ 4. ПЕРЕНОС КОРЗИНЫ (если есть guestId)
    if (guestId) {
      console.log(`🔄 Перенос корзины при OAuth входе...`);
      await mergeCart(user.id, guestId);
    }

    // 5. Генерируем JWT
    const token = generateToken(user.id);
    console.log('🎫 JWT generated for user:', user.id);

    return { user, token };
  } catch (error: any) {
    console.error('❌ Yandex callback error:', error.message);
    if (error.response) {
      console.error('📦 Response data:', error.response.data);
    }
    throw error;
  }
}

// ============================================================
// MAX
// ============================================================

export function getMaxAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: MAX_CONFIG.clientId,
    redirect_uri: MAX_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'email profile phone',
    state: 'max_oauth',
  });
  const url = `${MAX_CONFIG.authUrl}?${params.toString()}`;
  console.log('🔑 MAX auth URL:', url);
  return url;
}

export async function handleMaxCallback(code: string, guestId?: string) {
  console.log('📥 MAX callback received, code:', code.substring(0, 10) + '...');

  try {
    // 1. Получаем токен доступа
    console.log('🔄 Requesting MAX token...');
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
      }
    );

    const { access_token } = tokenResponse.data;
    console.log('✅ MAX token received');

    // 2. Получаем данные пользователя
    console.log('🔄 Requesting MAX user info...');
    const userInfo = await axios.get(MAX_CONFIG.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const {
      sub: maxId,
      email,
      given_name: firstName,
      family_name: lastName,
      phone_number: phone,
      email_verified,
    } = userInfo.data;
    
    console.log('👤 MAX user:', { maxId, email, firstName, lastName, phone });

    if (!email) {
      throw new Error('Не удалось получить email от MAX');
    }

    // 3. Ищем или создаём пользователя
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ maxId }, { email }],
      },
    });

    if (!user) {
      console.log('🆕 Creating new user from MAX');
      user = await prisma.user.create({
        data: {
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          phone: phone || null,
          maxId,
          isVerified: email_verified || true,
          role: 'user',
        },
      });
      console.log(`✅ Создан пользователь: ${user.id} (${user.email})`);
    } else if (!user.maxId) {
      console.log('🔗 Linking MAX to existing user');
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          maxId,
          firstName: user.firstName || firstName || '',
          lastName: user.lastName || lastName || '',
          phone: user.phone || phone || null,
        },
      });
    } else {
      console.log('✅ User already exists with MAX');
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

    // ✅ 4. ПЕРЕНОС КОРЗИНЫ (если есть guestId)
    if (guestId) {
      console.log(`🔄 Перенос корзины при OAuth входе...`);
      await mergeCart(user.id, guestId);
    }

    // 5. Генерируем JWT
    const token = generateToken(user.id);
    console.log('🎫 JWT generated for user:', user.id);

    return { user, token };
  } catch (error: any) {
    console.error('❌ MAX callback error:', error.message);
    if (error.response) {
      console.error('📦 Response data:', error.response.data);
    }
    throw error;
  }
}