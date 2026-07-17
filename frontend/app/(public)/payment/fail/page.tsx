'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw, ShoppingCart, AlertCircle } from 'lucide-react';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const errorMessage = searchParams.get('error') || 'Произошла ошибка при оплате';

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <span className="text-muted-foreground/30">/</span>
          <Link href="/cart" className="hover:text-foreground transition">Корзина</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-foreground font-medium">Ошибка оплаты</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Оплата не прошла</h1>
          <p className="text-muted-foreground mb-2">{errorMessage}</p>
          {orderId && (
            <p className="text-sm text-muted-foreground/60 mb-6">
              Заказ #{orderId.slice(0, 8)}
            </p>
          )}

          {/* Возможные причины */}
          <div className="bg-muted rounded-xl p-4 mb-6 text-left">
            <h3 className="font-medium text-foreground mb-3">Возможные причины:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">•</span>
                <span>Недостаточно средств на карте</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">•</span>
                <span>Неверно введены данные карты</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">•</span>
                <span>Превышен лимит по карте</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground mt-0.5">•</span>
                <span>Техническая ошибка платежной системы</span>
              </li>
            </ul>
          </div>

          {/* Совет */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-500 mb-6 text-left flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p>💡 Попробуйте оплатить заказ снова. Если проблема повторяется, свяжитесь с нами.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href={orderId ? `/payment/${orderId}` : '/cart'} 
              className="px-6 py-3 bg-foreground text-background rounded-xl hover:bg-foreground/90 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Попробовать снова
            </Link>
            <Link 
              href="/cart" 
              className="px-6 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Вернуться в корзину
            </Link>
            <Link 
              href="/contacts" 
              className="px-6 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}