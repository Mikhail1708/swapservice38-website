// frontend/app/api/orders/details/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log(`📦 API route: Получение заказа по ID: ${id}`);

    if (!id) {
      return NextResponse.json(
        { error: 'Не указан ID заказа' },
        { status: 400 }
      );
    }

    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${BACKEND_URL}/api/orders/${id}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: 'Ошибка сервера' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Заказ не найден' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}