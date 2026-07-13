// frontend/app/api/auth/reset-password/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('📡 Проверка кода восстановления:', body.email);

    const response = await fetch(`${BACKEND_URL}/api/auth/reset-password/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('📦 Ответ бэкенда:', response.status);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Ошибка проверки кода:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}