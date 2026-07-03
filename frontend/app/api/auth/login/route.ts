// frontend/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = req.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    // ✅ ПЕРЕДАЁМ COOKIE ОТ БЭКЕНДА
    const setCookie = response.headers.get('set-cookie');
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    if (setCookie) {
      nextResponse.headers.set('Set-Cookie', setCookie);
    }
    
    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}