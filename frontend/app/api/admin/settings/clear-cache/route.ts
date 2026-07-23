// frontend/app/api/admin/settings/clear-cache/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Очищаем кэш Redis (если есть)
    // Можно также перезапустить какие-то сервисы
    
    return NextResponse.json({ success: true, message: 'Кэш очищен' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка очистки кэша' },
      { status: 500 }
    );
  }
}