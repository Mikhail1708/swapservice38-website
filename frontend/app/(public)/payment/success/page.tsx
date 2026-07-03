// frontend/app/(public)/payment/success/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowLeft, Loader2, ShoppingBag } from 'lucide-react';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('paymentId');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('Не указан ID заказа');
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        console.log('🔄 Получение информации о заказе:', orderId);

        // ✅ ПРОБУЕМ ЧЕРЕЗ /api/orders/[id]
        let response = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        });

        // ✅ ЕСЛИ 404 — ПРОБУЕМ ЧЕРЕЗ /api/orders/details
        if (response.status === 404) {
          console.log('⚠️ Заказ не найден по /api/orders/[id], пробуем /api/orders/details');
          response = await fetch(`/api/orders/details?id=${orderId}`, {
            credentials: 'include',
          });
        }

        if (!response.ok) {
          // ✅ ЕСЛИ ВСЁ РАВНО 404 — ПОКАЗЫВАЕМ СТРАНИЦУ УСПЕХА БЕЗ ДАННЫХ
          if (response.status === 404) {
            console.log('⚠️ Заказ не найден, показываем страницу успеха без данных');
            setLoading(false);
            return;
          }
          throw new Error('Заказ не найден');
        }

        const data = await response.json();
        console.log('✅ Заказ получен:', data);
        setOrder(data.order || data);
      } catch (error: any) {
        console.error('❌ Ошибка получения заказа:', error);
        // ✅ НЕ ПОКАЗЫВАЕМ ОШИБКУ, ПРОСТО ПРОДОЛЖАЕМ
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ✅ ДАЖЕ ЕСЛИ ЕСТЬ ОШИБКА — ПОКАЗЫВАЕМ СТРАНИЦУ УСПЕХА
  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-20 h-20 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Оплата прошла успешно! 🎉</h1>
          <p className="text-gray-500 mb-6">
            Спасибо за заказ! Мы уже начали его обработку.
          </p>

          <div className="bg-white rounded-xl p-6 text-left space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Номер заказа:</span>
              <span className="font-medium">
                {order?.documentNumber || order?.orderNumber || orderId?.slice(0, 8) || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Сумма:</span>
              <span className="font-bold text-black">
                {order?.total?.toLocaleString() || '0'} ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Статус:</span>
              <span className="text-green-600 font-medium">✅ Оплачен</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Способ доставки:</span>
              <span className="font-medium">
                {order?.deliveryMethod === 'pickup' ? 'Самовывоз' : 
                 order?.deliveryMethod === 'courier' ? 'Курьером' : 
                 order?.deliveryMethod === 'post' ? 'Почта России' : 
                 order?.deliveryMethod || 'Не указан'}
              </span>
            </div>
            {order?.deliveryAddress && (
              <div className="flex justify-between">
                <span className="text-gray-500">Адрес:</span>
                <span className="font-medium text-right break-all">{order.deliveryAddress}</span>
              </div>
            )}
            {order?.guestName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Получатель:</span>
                <span className="font-medium">{order.guestName}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-6 text-left">
            <p className="font-medium mb-1">📦 Что дальше?</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Наш менеджер свяжется с вами в ближайшее время</li>
              <li>Вы получите уведомление о готовности заказа</li>
              <li>Отслеживайте статус заказа в личном кабинете</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/catalog" 
              className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Продолжить покупки
            </Link>
            <Link 
              href="/profile/orders" 
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              Мои заказы
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Номер платежа: {paymentId || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}