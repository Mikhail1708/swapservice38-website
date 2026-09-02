'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, Image, Link } from '@/lib/next-shims';
import { CheckCircle, Package, Loader2, ShoppingBag, AlertCircle, ArrowRight } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';
import { readApiError, userMessageFromError } from '@/lib/api-error';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('paymentId');
  const isMockPayment = searchParams.get('mock') === '1';

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
        let confirmedPaymentId = paymentId;
        const currentOrderResponse = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        });
        if (currentOrderResponse.ok) {
          const currentOrderData = await currentOrderResponse.json();
          const currentOrder = currentOrderData.order || currentOrderData;
          setOrder(currentOrder);
          confirmedPaymentId ||= currentOrder.paymentId;
        }

        if (!confirmedPaymentId) {
          throw new Error('Платёж не связан с заказом');
        }

        if (isMockPayment) {
          const mockResponse = await fetchWithCsrf('/api/payment/mock/complete', {
            method: 'POST',
            body: JSON.stringify({ orderId, paymentId: confirmedPaymentId }),
          });
          if (!mockResponse.ok) {
            throw new Error(await readApiError(mockResponse, 'Не удалось завершить тестовый платёж'));
          }
        }

        const response = await fetchWithCsrf('/api/payment/confirm', {
          method: 'POST',
          body: JSON.stringify({ orderId, paymentId: confirmedPaymentId }),
        });

        if (!response.ok) {
          setError(await readApiError(response, 'Не удалось проверить оплату. Попробуйте позже.'));
          setLoading(false);
          return;
        }

        const orderResponse = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        });

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          setOrder(orderData.order || orderData);
        } else {
          setOrder({ id: orderId, status: 'paid' });
        }

      } catch (error: unknown) {
        setError(error instanceof TypeError
          ? userMessageFromError(error, 'Не удалось проверить оплату. Попробуйте позже.')
          : error instanceof Error ? error.message : 'Не удалось проверить оплату. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    processPayment();
  }, [isMockPayment, orderId, paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-32">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Подтверждение оплаты...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full border flex items-center justify-center ${error ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
              {error
                ? <AlertCircle className="w-10 h-10 text-yellow-500" />
                : <CheckCircle className="w-10 h-10 text-green-500" />}
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {error ? 'Проверяем статус оплаты' : 'Оплата подтверждена! 🎉'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error
              ? 'Не удалось получить окончательное подтверждение. Проверьте заказ в личном кабинете.'
              : 'Спасибо за заказ! Мы уже начали его обработку.'}
          </p>

          {error && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-500 mb-6 text-left flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Подтверждение ещё не получено:</p>
                <p>{error}</p>
                <p className="text-xs mt-1 text-muted-foreground">Наш менеджер свяжется с вами в ближайшее время.</p>
              </div>
            </div>
          )}

          {/* Информация о заказе */}
          <div className="bg-muted rounded-xl p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Номер заказа</span>
              <span className="font-medium text-foreground">
                {order?.documentNumber || order?.orderNumber || orderId?.slice(0, 8) || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма</span>
              <span className="font-bold text-foreground">
                {order?.total?.toLocaleString() || '0'} ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Статус</span>
              <span className={error ? 'text-yellow-500 font-medium' : 'text-green-500 font-medium'}>
                {error ? 'Ожидает проверки' : '✅ Оплачен'}
              </span>
            </div>
          </div>

          {/* Что дальше */}
          <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6 text-left">
            <p className="font-medium text-foreground mb-2">📦 Что дальше?</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">1.</span>
                <span>Наш менеджер свяжется с вами в ближайшее время</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">2.</span>
                <span>Вы получите уведомление о готовности заказа</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">3.</span>
                <span>Отслеживайте статус заказа в личном кабинете</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/catalog" 
              className="px-6 py-3 bg-foreground text-background rounded-xl hover:bg-foreground/90 transition flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Продолжить покупки
            </Link>
            <Link 
              href="/profile/orders" 
              className="px-6 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition flex items-center justify-center gap-2"
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
