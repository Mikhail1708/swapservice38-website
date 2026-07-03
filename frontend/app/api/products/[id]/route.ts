import { NextRequest, NextResponse } from 'next/server';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const url = `${CRM_API_URL}/api/public/products/${id}`;

    console.log('🔄 Запрос к CRM для товара:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ CRM error:', response.status);
      // Возвращаем мок-товар
      return NextResponse.json(getMockProduct(id));
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Product API error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения товара' },
      { status: 500 }
    );
  }
}

function getMockProduct(id: string) {
  const products = [
    {
      id: '1',
      name: 'Боди-лифт Nissan Patrol Y60',
      description: 'Комплект для поднятия кузова на 50 мм. Включает все необходимые проставки и болты. Изготовлен из высокопрочной стали с порошковым покрытием.',
      price: 15000,
      oldPrice: 18000,
      category: 'Боди-лифт',
      carModel: 'Nissan Patrol Y60',
      inStock: true,
      images: ['/images/products/body-lift.jpg'],
      sku: 'BL-NP-Y60-50',
      rating: 4.8,
      reviews: 12,
      features: ['Сталь 3 мм', 'Порошковое покрытие', 'Высота подъёма 50 мм', 'Вес 8 кг'],
    },
  ];
  return products.find(p => p.id === id) || null;
}