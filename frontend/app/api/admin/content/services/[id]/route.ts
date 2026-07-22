// frontend/app/api/admin/content/services/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const url = `${BACKEND_URL}/api/admin/services/${id}`;
    const cookie = request.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] GET /api/admin/content/services/${id} ->`, url);

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
    console.error(`❌ GET /api/admin/content/services/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Ошибка загрузки услуги' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const url = `${BACKEND_URL}/api/admin/services/${id}`;
    const cookie = request.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] PUT /api/admin/content/services/${id} ->`, url);

    const response = await fetch(url, {
      method: 'PUT',
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
    console.error(`❌ PUT /api/admin/content/services/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Ошибка обновления услуги' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const url = `${BACKEND_URL}/api/admin/services/${id}`;
    const cookie = request.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] DELETE /api/admin/content/services/${id} ->`, url);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error(`❌ DELETE /api/admin/content/services/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Ошибка удаления услуги' },
      { status: 500 }
    );
  }
}