// frontend/app/(public)/payment/[orderId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { getCsrfToken } from '@/lib/csrf';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  useEffect(() => {
    console.log('📄 PaymentPage mounted, orderId:', orderId);

    if (!orderId) {
      console.error('❌ orderId отсутствует');
      setError('Не указан ID заказа');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        console.log(`🔄 1. Загрузка заказа ${orderId}...`);

        // 1. Получаем заказ
        const orderResponse = await fetch(`/api/orders/details?id=${orderId}`, {
          credentials: 'include',
        });

        console.log(`📦 2. Статус ответа: ${orderResponse.status}`);

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          console.error('❌ 3. Ошибка получения заказа:', errorData);
          throw new Error(errorData.error || 'Заказ не найден');
        }

        const orderData = await orderResponse.json();
        console.log('✅ 4. Заказ получен:', orderData);
        setOrder(orderData.order || orderData);

        // 2. Принудительно получаем CSRF токен
        console.log('🛡️ Получение CSRF токена...');
        const csrfToken = await getCsrfToken();
        console.log('✅ CSRF токен получен:', csrfToken.substring(0, 10) + '...');

        // 3. Создаём платёж с CSRF токеном в заголовках
        console.log(`💳 5. Создание платежа для заказа ${orderId}...`);
        setIsCreatingPayment(true);

        const paymentResponse = await fetch('/api/payment/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ 
            orderId: orderId,
            _csrf: csrfToken,
          }),
          credentials: 'include',
        });

        console.log(`📦 6. Статус платежа: ${paymentResponse.status}`);

        const paymentData = await paymentResponse.json();
        console.log('📦 7. Ответ платежа:', paymentData);
        
        if (paymentResponse.ok && paymentData.paymentUrl) {
          console.log('✅ 8. Платёж создан, URL:', paymentData.paymentUrl);
          setPaymentUrl(paymentData.paymentUrl);
        } else {
          console.error('❌ 9. Ошибка создания платежа:', paymentData);
          setError(paymentData.error || 'Не удалось создать платёж');
        }
      } catch (error: any) {
        console.error('❌ 10. Критическая ошибка:', error);
        setError(error.message || 'Произошла ошибка');
      } finally {
        console.log('🏁 11. Завершение загрузки');
        setLoading(false);
        setIsCreatingPayment(false);
      }
    };

    fetchData();
  }, [orderId]);

  const handlePay = () => {
    if (paymentUrl) {
      console.log('🔗 Редирект на оплату:', paymentUrl);
      window.location.href = paymentUrl;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-black">Ошибка</h2>
            <p className="text-gray-400 mt-2">{error}</p>
            <Link 
              href="/cart" 
              className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
            >
              Вернуться в корзину
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <Link href="/cart" className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          Назад в корзину
        </Link>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-black mb-6">Оплата заказа</h1>

          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Номер заказа:</span>
              <span className="font-medium">{order?.documentNumber || orderId.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Сумма:</span>
              <span className="font-bold text-xl">{order?.total?.toLocaleString() || 0} ₽</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Статус:</span>
              <span className="text-yellow-600 font-medium">Ожидает оплаты</span>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={!paymentUrl || isCreatingPayment}
            className="w-full mt-8 py-4 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingPayment ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Подготовка оплаты...
              </>
            ) : paymentUrl ? (
              <>
                <CreditCard className="w-5 h-5" />
                Оплатить через ЮKassa
              </>
            ) : (
              'Не удалось создать платёж'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Вы будете перенаправлены на безопасную страницу оплаты
          </p>
        </div>
      </div>
    </div>
  );
}