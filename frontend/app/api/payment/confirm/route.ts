// frontend/app/api/payment/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paymentId } = body;
    const token = request.cookies.get('token')?.value;

    console.log(`💳 API: Подтверждение оплаты заказа ${orderId}`);

    if (!orderId) {
      return NextResponse.json(
        { error: 'Не указан ID заказа' },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/payment/confirm`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ orderId, paymentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Ошибка подтверждения оплаты' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}