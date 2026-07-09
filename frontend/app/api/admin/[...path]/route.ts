import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

// ============================================================
// GET — все GET-запросы к админке
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = req.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/admin/${path}${searchParams ? `?${searchParams}` : ''}`;
    const cookie = req.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] GET ${url}`);

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
    console.error('❌ [PROXY] GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — все POST-запросы к админке
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = `${BACKEND_URL}/api/admin/${path}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();

    console.log(`🔄 [PROXY] POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
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
    console.error('❌ [PROXY] POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT — все PUT-запросы к админке
// ============================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = `${BACKEND_URL}/api/admin/${path}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();

    console.log(`🔄 [PROXY] PUT ${url}`);

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
    console.error('❌ [PROXY] PUT error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH — все PATCH-запросы к админке
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = `${BACKEND_URL}/api/admin/${path}`;
    const cookie = req.headers.get('cookie') || '';
    const body = await req.json();

    console.log(`🔄 [PROXY] PATCH ${url}`);

    const response = await fetch(url, {
      method: 'PATCH',
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
    console.error('❌ [PROXY] PATCH error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE — все DELETE-запросы к админке
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = `${BACKEND_URL}/api/admin/${path}`;
    const cookie = req.headers.get('cookie') || '';

    console.log(`🔄 [PROXY] DELETE ${url}`);

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
    console.error('❌ [PROXY] DELETE error:', error);
    return NextResponse.json(
      { error: 'Ошибка проксирования запроса' },
      { status: 500 }
    );
  }
}

// ============================================================
// OPTIONS — для CORS
// ============================================================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    },
  });
}