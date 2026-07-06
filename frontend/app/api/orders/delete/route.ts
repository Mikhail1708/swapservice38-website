// frontend/app/api/orders/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log(`🗑️ DELETE /api/orders/delete?id=${id}`);

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

    const response = await fetch(`${BACKEND_URL}/api/orders/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Ошибка удаления заказа' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Ошибка DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}