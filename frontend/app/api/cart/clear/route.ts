// frontend/app/api/cart/clear/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 API: Очистка корзины');

    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    console.log('🛡️ CSRF токен из заголовков:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

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

    const response = await fetch(`${BACKEND_URL}/api/cart/clear`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    console.log('📦 Ответ бэкенда:', response.status, data);

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси очистки корзины:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка очистки корзины' },
      { status: 500 }
    );
  }
}