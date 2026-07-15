// frontend/app/(public)/payment/fail/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const errorMessage = searchParams.get('error') || 'Произошла ошибка при оплате';

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="w-20 h-20 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Оплата не прошла</h1>
          <p className="text-gray-500 mb-2">{errorMessage}</p>
          <p className="text-sm text-gray-400 mb-6">
            {orderId ? `Заказ #${orderId.slice(0, 8)}` : ''}
          </p>

          <div className="bg-white rounded-xl p-6 text-left space-y-3 mb-6">
            <h3 className="font-medium text-black">Возможные причины:</h3>
            <ul className="text-sm text-gray-500 space-y-2 list-disc pl-5">
              <li>Недостаточно средств на карте</li>
              <li>Неверно введены данные карты</li>
              <li>Превышен лимит по карте</li>
              <li>Техническая ошибка платежной системы</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700 mb-6">
            <p>💡 Попробуйте оплатить заказ снова. Если проблема повторяется, свяжитесь с нами.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href={orderId ? `/payment/${orderId}` : '/cart'} 
              className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Попробовать снова
            </Link>
            <Link 
              href="/cart" 
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Вернуться в корзину
            </Link>
            <Link 
              href="/contacts" 
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}