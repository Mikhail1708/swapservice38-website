// frontend/app/api/payment/resend/route.ts (ДЛЯ АДМИНОВ)
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;
    const token = request.cookies.get('token')?.value;

    console.log(`🔄 API: Принудительная отправка заказа ${orderId} в CRM`);

    if (!orderId) {
      return NextResponse.json(
        { error: 'Не указан ID заказа' },
        { status: 400 }
      );
    }

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

    const response = await fetch(`${BACKEND_URL}/api/payment/resend`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ orderId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Ошибка отправки заказа в CRM' },
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