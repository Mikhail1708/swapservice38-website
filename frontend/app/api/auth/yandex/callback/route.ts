import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams.toString();
    const backendUrl = `${BACKEND_URL}/api/auth/yandex/callback${searchParams ? `?${searchParams}` : ''}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
      },
    });

    // Проксируем cookie от бэкенда
    const data = await response.json();
    const res = NextResponse.json(data, { status: response.status });
    
    // Если бэкенд устанавливает cookie, проксируем их
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('Set-Cookie', setCookie);
    }

    return res;
  } catch (error) {
    console.error('Yandex OAuth callback proxy error:', error);
    return NextResponse.json(
      { error: 'Ошибка обработки входа через Яндекс' },
      { status: 500 }
    );
  }
}