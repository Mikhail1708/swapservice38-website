import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = req.headers.get('cookie') || '';
    
    console.log('🛒 API: Добавление в корзину', body);

    const response = await fetch(`${BACKEND_URL}/api/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const data = await response.json();
    console.log('📦 Ответ бэкенда:', data);

    const res = NextResponse.json(data, { status: response.status });
    
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('Set-Cookie', setCookie);
    }

    return res;
  } catch (error: any) {
    console.error('❌ Cart add proxy error:', error);
    return NextResponse.json(
      { error: 'Ошибка добавления в корзину: ' + error.message },
      { status: 500 }
    );
  }
}