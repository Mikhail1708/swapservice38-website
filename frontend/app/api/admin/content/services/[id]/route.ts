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
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    console.log(`🔄 [PROXY] GET /api/admin/content/services/${id} ->`, url);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
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
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token') ||
                      body._csrf;

    console.log(`🔄 [PROXY] PUT /api/admin/content/services/${id} ->`, url);
    console.log('🛡️ CSRF токен в PUT:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const requestBody = {
      ...body,
      _csrf: csrfToken || undefined,
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(requestBody),
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
    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    console.log(`🔄 [PROXY] DELETE /api/admin/content/services/${id} ->`, url);
    console.log('🛡️ CSRF токен в DELETE:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
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