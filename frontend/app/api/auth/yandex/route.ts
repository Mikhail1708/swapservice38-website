import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(req: NextRequest) {
  try {
    // Перенаправляем на бэкенд
    const backendUrl = `${BACKEND_URL}/api/auth/yandex`;
    
    // Получаем все query параметры от клиента
    const searchParams = req.nextUrl.searchParams.toString();
    const url = searchParams ? `${backendUrl}?${searchParams}` : backendUrl;
    
    // Делаем запрос к бэкенду
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
      },
    });

    // Если бэкенд возвращает редирект (302) — перенаправляем пользователя
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location');
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // Иначе возвращаем ответ
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Yandex OAuth proxy error:', error);
    return NextResponse.json(
      { error: 'Ошибка входа через Яндекс' },
      { status: 500 }
    );
  }
}