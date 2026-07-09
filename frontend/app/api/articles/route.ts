// frontend/app/api/articles/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/articles${searchParams ? `?${searchParams}` : ''}`;
    const cookie = req.headers.get('cookie') || '';

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка загрузки статей' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = req.headers.get('cookie') || '';
    const url = `${BACKEND_URL}/api/articles`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка создания статьи' }, { status: 500 });
  }
}