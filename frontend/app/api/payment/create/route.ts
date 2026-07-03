// frontend/app/api/payment/create/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    console.log('💳 Создание платежа через API proxy');
    console.log('📦 Данные:', { orderId });

    if (!orderId) {
      return NextResponse.json(
        { error: 'Не указан ID заказа' },
        { status: 400 }
      );
    }

    const token = request.cookies.get('token')?.value;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ✅ ПРОВЕРЯЕМ, ЧТО ЗАКАЗ СУЩЕСТВУЕТ
    // Сначала получаем заказ из бэкенда
    const orderCheck = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
      headers,
      credentials: 'include',
    });

    if (!orderCheck.ok) {
      console.error('❌ Заказ не найден в бэкенде');
      return NextResponse.json(
        { error: 'Заказ не найден' },
        { status: 404 }
      );
    }

    const orderData = await orderCheck.json();
    console.log('✅ Заказ найден:', orderData);

    // Создаём платёж в бэкенде
    const response = await fetch(`${BACKEND_URL}/api/payment/create`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ orderId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Ошибка создания платежа:', data);
      return NextResponse.json(
        { error: data.error || 'Ошибка создания платежа' },
        { status: response.status }
      );
    }

    console.log('✅ Платёж создан:', data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}