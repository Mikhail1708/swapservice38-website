// frontend/app/api/payment/create/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    console.log('💳 Создание платежа через API proxy');
    
    // Получаем данные из запроса
    const body = await request.json();
    console.log('📦 Данные:', body);

    // ✅ Получаем CSRF токен из заголовков запроса (клиент → Next.js)
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    console.log('🛡️ CSRF токен из заголовков:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

    // ✅ Формируем заголовки для бэкенда
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // ✅ Передаём CSRF токен в бэкенд
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    // ✅ Передаём токен авторизации
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // ✅ Передаём cookies
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // ✅ Добавляем _csrf в тело
    const requestBody = {
      ...body,
      _csrf: csrfToken || undefined,
    };

    console.log('📤 Отправка в бэкенд:', {
      url: `${BACKEND_URL}/api/payment/create`,
      headers: Object.keys(headers),
      hasCsrf: !!csrfToken,
      bodyKeys: Object.keys(requestBody),
    });

    const response = await fetch(`${BACKEND_URL}/api/payment/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const data = await response.json();

    console.log('📦 Ответ бэкенда:', response.status, data);

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси создания платежа:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка создания платежа' },
      { status: 500 }
    );
  }
}