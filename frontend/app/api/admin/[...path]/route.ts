// frontend/app/api/admin/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

// ============================================================
// ПРЕОБРАЗОВАНИЕ ПУТЕЙ
// ============================================================
function transformPath(path: string): string {
  // /content/services/:id → /services/:id
  if (path.startsWith('content/services/')) {
    return path.replace('content/services/', 'services/');
  }
  // /content/services → /services
  if (path === 'content/services') {
    return 'services';
  }
  // /content/articles/:id → /articles/:id
  if (path.startsWith('content/articles/')) {
    return path.replace('content/articles/', 'articles/');
  }
  // /content/articles → /articles
  if (path === 'content/articles') {
    return 'articles';
  }
  // /content/news/:id → /news/:id
  if (path.startsWith('content/news/')) {
    return path.replace('content/news/', 'news/');
  }
  // /content/news → /news
  if (path === 'content/news') {
    return 'news';
  }
  return path;
}

// ============================================================
// GET
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const transformedPath = transformPath(path);
    const searchParams = req.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/admin/${transformedPath}${searchParams ? `?${searchParams}` : ''}`;
    const cookie = req.headers.get('cookie') || '';
    const csrfToken = req.headers.get('x-csrf-token') || 
                      req.headers.get('csrf-token') ||
                      req.headers.get('CSRF-Token');

    console.log(`🔄 [PROXY] GET ${url} (original: ${path})`);

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
    console.error('❌ [PROXY] GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const transformedPath = transformPath(path);
    const url = `${BACKEND_URL}/api/admin/${transformedPath}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();
    const csrfToken = req.headers.get('x-csrf-token') || 
                      req.headers.get('csrf-token') ||
                      req.headers.get('CSRF-Token') ||
                      body._csrf;

    console.log(`🔄 [PROXY] POST ${url} (original: ${path})`);
    console.log('🛡️ CSRF токен в POST:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

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
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('❌ [PROXY] POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT
// ============================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const transformedPath = transformPath(path);
    const url = `${BACKEND_URL}/api/admin/${transformedPath}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();
    const csrfToken = req.headers.get('x-csrf-token') || 
                      req.headers.get('csrf-token') ||
                      req.headers.get('CSRF-Token') ||
                      body._csrf;

    console.log(`🔄 [PROXY] PUT ${url} (original: ${path})`);
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
    console.error('❌ [PROXY] PUT error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const transformedPath = transformPath(path);
    const url = `${BACKEND_URL}/api/admin/${transformedPath}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();
    const csrfToken = req.headers.get('x-csrf-token') || 
                      req.headers.get('csrf-token') ||
                      req.headers.get('CSRF-Token') ||
                      body._csrf;

    console.log(`🔄 [PROXY] PATCH ${url} (original: ${path})`);
    console.log('🛡️ CSRF токен в PATCH:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'отсутствует');

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
      method: 'PATCH',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('❌ [PROXY] PATCH error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const transformedPath = transformPath(path);
    const url = `${BACKEND_URL}/api/admin/${transformedPath}`;
    const cookie = req.headers.get('cookie') || '';
    const csrfToken = req.headers.get('x-csrf-token') || 
                      req.headers.get('csrf-token') ||
                      req.headers.get('CSRF-Token');

    console.log(`🔄 [PROXY] DELETE ${url} (original: ${path})`);
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
    console.error('❌ [PROXY] DELETE error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// OPTIONS
// ============================================================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-CSRF-Token, CSRF-Token',
    },
  });
}