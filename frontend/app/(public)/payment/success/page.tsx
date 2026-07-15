// frontend/app/(public)/payment/success/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, Loader2, ShoppingBag, AlertCircle } from 'lucide-react';
import { getCsrfToken } from '@/lib/csrf';

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

    const processPayment = async () => {
      try {
        console.log(`🔄 Обработка оплаты заказа ${orderId}...`);

        // Получаем CSRF токен
        const csrfToken = await getCsrfToken();

        // Отправляем подтверждение оплаты с CSRF токеном
        const response = await fetch('/api/payment/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ 
            orderId, 
            paymentId,
            _csrf: csrfToken,
          }),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('❌ Ошибка обработки оплаты:', data);
          setError(data.error || 'Ошибка обработки оплаты');
          setLoading(false);
          return;
        }

        console.log('✅ Оплата обработана:', data);

        // Загружаем обновлённый заказ
        const orderResponse = await fetch(`/api/orders/details?id=${orderId}`, {
          credentials: 'include',
        });

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          setOrder(orderData.order || orderData);
        } else {
          setOrder({ id: orderId, status: 'paid' });
        }

      } catch (error: any) {
        console.error('❌ Ошибка:', error);
        setError(error.message || 'Ошибка обработки оплаты');
      } finally {
        setLoading(false);
      }
    };

    processPayment();
  }, [orderId, paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

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

          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700 mb-6 text-left flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Оплата прошла, но есть нюанс:</p>
                <p>{error}</p>
                <p className="text-xs mt-1">Наш менеджер свяжется с вами в ближайшее время.</p>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}