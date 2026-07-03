import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

// Получение корзины
export async function GET(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/api/cart`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения корзины' },
      { status: 500 }
    );
  }
}

// Добавление в корзину
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = req.headers.get('cookie') || '';
    
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
    const res = NextResponse.json(data, { status: response.status });
    
    // Проксируем cookies (для guestId)
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('Set-Cookie', setCookie);
    }

    return res;
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка добавления в корзину' },
      { status: 500 }
    );
  }
}

// Обновление корзины
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = req.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/api/cart/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка обновления корзины' },
      { status: 500 }
    );
  }
}

// Очистка корзины
export async function DELETE(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/api/cart/clear`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка очистки корзины' },
      { status: 500 }
    );
  }
}