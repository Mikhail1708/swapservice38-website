'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CreditCard, ArrowLeft, CheckCircle, AlertCircle, Clock, Shield } from 'lucide-react';
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

        // 3. Создаём платёж
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
      <div className="min-h-screen bg-background flex items-center justify-center pt-32">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка платежа...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Ошибка</h2>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Link 
              href="/cart" 
              className="inline-block mt-6 px-6 py-3 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition"
            >
              Вернуться в корзину
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Если заказ уже оплачен
  if (order?.status === 'paid') {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Заказ уже оплачен</h2>
            <p className="text-muted-foreground mt-2">Этот заказ уже был оплачен</p>
            <Link 
              href="/profile/orders" 
              className="inline-block mt-6 px-6 py-3 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition"
            >
              Перейти к заказам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <span className="text-muted-foreground/30">/</span>
          <Link href="/cart" className="hover:text-foreground transition">Корзина</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-foreground font-medium">Оплата</span>
        </div>

        <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          Назад в корзину
        </Link>

        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Оплата заказа</h1>
          </div>

          {/* Информация о заказе */}
          <div className="bg-muted rounded-xl p-4 mb-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Номер заказа</span>
              <span className="font-medium text-foreground">
                #{order?.documentNumber || order?.orderNumber || orderId.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма</span>
              <span className="text-2xl font-bold text-foreground">
                {order?.total?.toLocaleString() || 0} ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Статус</span>
              <span className="text-yellow-500 font-medium flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Ожидает оплаты
              </span>
            </div>
          </div>

          {/* Безопасность */}
          <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6 flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Безопасная оплата</p>
              <p className="text-xs text-muted-foreground">
                Данные передаются по защищённому соединению через платёжный шлюз ЮKassa
              </p>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={!paymentUrl || isCreatingPayment}
            className="w-full py-4 bg-foreground text-background rounded-2xl font-medium hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <p className="text-xs text-muted-foreground/50 text-center mt-4">
            Вы будете перенаправлены на безопасную страницу оплаты
          </p>

          <div className="mt-6 pt-6 border-t border-border flex justify-center gap-6 text-xs text-muted-foreground/50">
            <span>🔒 Безопасное соединение</span>
            <span>💳 Принимаем все карты</span>
            <span>🔄 Мгновенное подтверждение</span>
          </div>
        </div>
      </div>
    </div>
  );
}