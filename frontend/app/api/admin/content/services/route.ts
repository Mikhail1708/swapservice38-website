// frontend/app/api/admin/content/services/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/admin/services${queryString ? `?${queryString}` : ''}`;
    
    const cookie = request.headers.get('cookie') || '';

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
    const url = `${BACKEND_URL}/api/admin/services`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
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