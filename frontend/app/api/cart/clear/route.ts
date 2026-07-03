import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function DELETE(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    
    console.log('🧹 API: Очистка корзины');

    const response = await fetch(`${BACKEND_URL}/api/cart/clear`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
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
    console.error('❌ Cart clear proxy error:', error);
    return NextResponse.json(
      { error: 'Ошибка очистки корзины: ' + error.message },
      { status: 500 }
    );
  }
}