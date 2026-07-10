import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    
    // Удаляем токен из cookies
    response.cookies.delete('token');
    response.cookies.delete('refreshToken');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Ошибка при выходе' },
      { status: 500 }
    );
  }
}