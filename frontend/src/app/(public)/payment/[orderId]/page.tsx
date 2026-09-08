// frontend/app/(public)/payment/[orderId]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, Image, Link } from '@/lib/next-shims';
import { Loader2, CreditCard, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { getSafePaymentRedirect } from '@/lib/safe-navigation';
import { fetchWithCsrf } from '@/lib/csrf';
import { readApiError, userMessageFromError } from '@/lib/api-error';
import { OrderTransferNotice } from '@/components/OrderTransferNotice';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  
  // ✅ БЛОКИРОВКА ПОВТОРНЫХ ЗАПРОСОВ
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!orderId) {
      setError('Не указан ID заказа');
      setLoading(false);
      return;
    }

    // ✅ БЛОКИРУЕМ ПОВТОРНЫЙ ЗАПРОС ПРИ ПЕРЕЗАГРУЗКЕ СТРАНИЦЫ
    if (isProcessingRef.current) {
      return () => { isMountedRef.current = false; };
    }
    isProcessingRef.current = true;

    const fetchData = async () => {
      try {
        // 1. Получаем заказ
        const orderResponse = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        });

        if (!orderResponse.ok) {
          throw new Error(await readApiError(orderResponse, 'Не удалось загрузить заказ.'));
        }

        const orderData = await orderResponse.json();
        setOrder(orderData.order || orderData);

        // 2. Проверяем статус заказа
        const orderStatus = orderData.order?.status || orderData.status;
        const cancellationState = orderData.order?.cancellationState || orderData.cancellationState;
        if (orderStatus === 'cancelled' || ['requested', 'accepted'].includes(cancellationState)) {
          throw new Error('Оплата недоступна: заказ отменён или ожидает решения по отмене');
        }

        // 3. Создаём платёж
        setIsCreatingPayment(true);

        const paymentResponse = await fetchWithCsrf('/api/payment/create', {
          method: 'POST',
          body: JSON.stringify({ orderId }),
        });

        const paymentData = await paymentResponse.clone().json().catch(() => ({}));

        const safePaymentUrl = getSafePaymentRedirect(paymentData.paymentUrl);
        if (paymentResponse.ok && safePaymentUrl) {
          setPaymentUrl(safePaymentUrl);
        } else if (paymentResponse.ok && paymentData.paymentUrl) {
          setError('Платёжный сервис вернул небезопасный адрес перенаправления');
        } else {
          // Если заказ уже обработан — перенаправляем на страницу успеха или в профиль
          if (paymentData.error === 'Заказ уже обработан') {
            router.push('/profile/orders');
            return;
          }
          setError(await readApiError(paymentResponse, 'Не удалось начать оплату. Попробуйте ещё раз.'));
        }
      } catch (error: unknown) {
        setError(error instanceof TypeError
          ? userMessageFromError(error, 'Не удалось начать оплату. Попробуйте ещё раз.')
          : error instanceof Error ? error.message : 'Не удалось начать оплату. Попробуйте ещё раз.');
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsCreatingPayment(false);
          isProcessingRef.current = false;
        }
      }
    };

    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [orderId, router]);

  // ✅ РЕДИРЕКТ НА ОПЛАТУ
  const handlePay = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl;
    }
  };

  // ✅ LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ✅ ОШИБКА
  if (error) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Ошибка</h2>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Link 
              href="/profile/orders" 
              className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Перейти к заказам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ✅ УСПЕХ (ЗАКАЗ УЖЕ ОПЛАЧЕН)
  if (order?.status === 'paid') {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <Link href="/profile/orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-6">
            <ArrowLeft className="w-4 h-4" />
            Назад к заказам
          </Link>

          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Заказ уже оплачен! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              Ваш заказ уже обработан. Спасибо за покупку!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/profile/orders" 
                className="px-6 py-3 bg-foreground text-background rounded-xl hover:bg-foreground/90 transition"
              >
                Мои заказы
              </Link>
              <Link 
                href="/catalog" 
                className="px-6 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition"
              >
                Продолжить покупки
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ СТРАНИЦА ОПЛАТЫ
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <Link href="/profile/orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          Назад к заказам
        </Link>

        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-6">Оплата заказа</h1>

          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Номер заказа:</span>
              <span className="font-medium text-foreground">{order?.orderNumber || orderId.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Сумма:</span>
              <span className="font-bold text-2xl text-foreground">{order?.total?.toLocaleString() || 0} ₽</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Статус:</span>
              <span className="text-yellow-500 font-medium">Ожидает оплаты</span>
            </div>
          </div>

          <OrderTransferNotice deliveryMethod={order?.deliveryMethod || ''} />
          <button
            onClick={handlePay}
            disabled={!paymentUrl || isCreatingPayment}
            className="w-full mt-8 py-4 bg-primary text-primary-foreground rounded-2xl font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        </div>
      </div>
    </div>
  );
}
