// frontend/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
      },
    });

    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    // ✅ УДАЛЯЕМ ТОКЕН
    nextResponse.cookies.delete('token');
    
    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}