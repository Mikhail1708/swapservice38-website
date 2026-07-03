// frontend/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get('token')?.value;
    const guestId = request.cookies.get('guestId')?.value;

    console.log('📝 API route: Создание заказа');
    console.log('  Token:', token ? 'есть' : 'нет');
    console.log('  GuestId:', guestId || 'нет');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let url = `${BACKEND_URL}/api/orders`;
    if (guestId) {
      url += `?guestId=${encodeURIComponent(guestId)}`;
    }

    console.log('📤 URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Ошибка сервера: ' + text.substring(0, 100));
    }

    if (!response.ok) {
      console.error('❌ Ошибка создания заказа:', data);
      return NextResponse.json(
        { error: data.error || 'Ошибка создания заказа' },
        { status: response.status }
      );
    }

    console.log('✅ Заказ создан:', data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Ошибка в API route:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}