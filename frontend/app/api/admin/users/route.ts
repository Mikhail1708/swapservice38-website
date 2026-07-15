// frontend/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

    // ✅ Получаем CSRF токен из заголовков
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    console.log('🛡️ CSRF токен в GET прокси:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(
      `${BACKEND_URL}/api/admin/users?page=${page}&limit=${limit}`,
      {
        headers,
        credentials: 'include',
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси users GET:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка получения пользователей' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('👤 Создание пользователя через API proxy');
    
    const body = await request.json();
    console.log('📦 Данные:', body);

    // ✅ Получаем CSRF токен из заголовков (ВСЕ ВАРИАНТЫ)
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token') ||
                      body._csrf;

    console.log('🛡️ CSRF токен в POST прокси:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');
    console.log('📋 Все заголовки:', Object.fromEntries(request.headers));

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const requestBody = {
      ...body,
      _csrf: csrfToken || undefined,
    };

    console.log('📤 Отправка в бэкенд:', {
      url: `${BACKEND_URL}/api/admin/users`,
      hasCsrf: !!csrfToken,
      headers: Object.keys(headers),
    });

    const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
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
    console.error('❌ Ошибка прокси создания пользователя:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка создания пользователя' },
      { status: 500 }
    );
  }
}