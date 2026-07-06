// frontend/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    
    console.log('📡 GET /api/auth/me -> backend');
    
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      credentials: 'include',
    });

    const data = await response.json();
    console.log('📦 Статус /api/auth/me:', response.status);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Ошибка /api/auth/me:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}