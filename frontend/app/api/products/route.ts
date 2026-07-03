// frontend/app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '100';

    let url = `${CRM_API_URL}/api/public/products?page=${page}&limit=${limit}`;
    if (category) url += `&category=${category}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    console.log('🔄 Запрос к CRM:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error('❌ CRM error:', response.status);
      return NextResponse.json({ items: [], total: 0, totalPages: 0 });
    }

    const data = await response.json();
    console.log(`✅ Получено товаров: ${data.items?.length || 0} из ${data.total}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Products API error:', error);
    return NextResponse.json({ items: [], total: 0, totalPages: 0 });
  }
}