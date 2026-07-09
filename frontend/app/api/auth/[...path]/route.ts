import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = `${BACKEND_URL}/api/auth/${path}`;
  const cookie = req.headers.get('cookie') || '';

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
    });

    const data = await response.json();
    const res = NextResponse.json(data, { status: response.status });

    // Проксируем cookies (для JWT)
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('Set-Cookie', setCookie);
    }

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка проксирования' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = `${BACKEND_URL}/api/auth/${path}`;
  const cookie = req.headers.get('cookie') || '';
  const body = await req.json();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const res = NextResponse.json(data, { status: response.status });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('Set-Cookie', setCookie);
    }

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка проксирования' }, { status: 500 });
  }
}