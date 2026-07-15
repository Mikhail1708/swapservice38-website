// frontend/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси получения пользователя:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка получения пользователя' },
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

    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const requestBody = {
      ...body,
      _csrf: csrfToken || undefined,
    };

    const response = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси обновления пользователя:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка обновления пользователя' },
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

    const csrfToken = request.headers.get('x-csrf-token') || 
                      request.headers.get('csrf-token') ||
                      request.headers.get('CSRF-Token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      headers['CSRF-Token'] = csrfToken;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('❌ Ошибка прокси удаления пользователя:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка удаления пользователя' },
      { status: 500 }
    );
  }
}