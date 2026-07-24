// frontend/app/api/admin/content/services/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/admin/services${queryString ? `?${queryString}` : ''}`;
    const cookie = request.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] GET /api/admin/content/services ->`, url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('❌ GET /api/admin/content/services error:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка загрузки услуг' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookie = request.headers.get('cookie') || '';
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token') ||
                      body._csrf;

    const url = `${BACKEND_URL}/api/admin/services`;

    console.log(`🔄 [PROXY] POST /api/admin/content/services ->`, url);
    console.log('🛡️ CSRF токен в POST:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const requestBody = {
      ...body,
      _csrf: csrfToken || undefined,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('❌ POST /api/admin/content/services error:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка создания услуги' },
      { status: 500 }
    );
  }
}