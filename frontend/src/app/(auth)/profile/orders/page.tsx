// frontend/app/(auth)/profile/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { Loader2, Package, ChevronRight, ShoppingBag, AlertCircle, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useAuth }  from '@/lib/hooks/useAuth';
import { fetchWithCsrf }  from '@/lib/csrf';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '⏳ Ожидает оплаты', color: 'bg-yellow-500/10 text-yellow-500' },
  paid: { label: '✅ Оплачен, ожидает подтверждения', color: 'bg-blue-500/10 text-blue-500' },
  confirmed: { label: '📦 Подтверждён', color: 'bg-indigo-500/10 text-indigo-500' },
  assembling: { label: '🔧 Собирается', color: 'bg-purple-500/10 text-purple-500' },
  packing: { label: '📦 Упаковывается', color: 'bg-purple-500/10 text-purple-500' },
  shipped: { label: '🚚 Отправлен', color: 'bg-green-500/10 text-green-500' },
  delivered: { label: '✅ Доставлен', color: 'bg-emerald-500/10 text-emerald-500' },
  cancelled: { label: '❌ Отменён', color: 'bg-red-500/10 text-red-500' },
  ordered: { label: '📋 Оформлен', color: 'bg-gray-500/10 text-gray-500' },
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        console.log('🔄 Загрузка заказов для пользователя:', user.id);
        
        // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf ДЛЯ GET (нужен CSRF токен)
        const response = await fetchWithCsrf('/api/orders', {
          method: 'GET',
        });

        console.log('📦 Статус ответа:', response.status);

        if (response.status === 401) {
          setError('Необходимо авторизоваться');
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Ошибка: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Заказы загружены:', data);
        setOrders(data.orders || []);
        setError(null);
      } catch (error: any) {
        console.error('❌ Ошибка загрузки заказов:', error);
        setError(error.message || 'Не удалось загрузить заказы');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, authLoading]);

  const getStatus = (status: string) => {
    return statusMap[status] || { label: status || 'Неизвестно', color: 'bg-gray-500/10 text-gray-500' };
  };

  const formatDate = (date: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка заказов...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-4xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-medium text-foreground">Требуется авторизация</h2>
            <p className="text-muted-foreground mt-2">Войдите в аккаунт, чтобы просмотреть свои заказы</p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <Link 
                href="/login?redirect=/profile/orders" 
                className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                Войти
              </Link>
              <Link 
                href="/register" 
                className="px-8 py-3 border border-border text-foreground rounded-lg hover:bg-muted transition"
              >
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/profile" className="hover:text-foreground transition">Профиль</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Мои заказы</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Package className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Мои заказы</h1>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {orders.length}
          </span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-foreground">У вас пока нет заказов</h2>
            <p className="text-muted-foreground mt-2">Перейдите в каталог и сделайте свой первый заказ</p>
            <Link 
              href="/catalog" 
              className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = getStatus(order.status);
              const itemsCount = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
              const displayNumber = order.orderNumber || order.documentNumber || order.id.slice(0, 8);

              return (
                <Link
                  key={order.id}
                  href={`/profile/orders/details?id=${order.id}`}
                  className="block bg-card border border-border rounded-2xl p-6 hover:border-foreground/30 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-foreground">
                          Заказ #{displayNumber}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2">
                        <span>{formatDate(order.createdAt)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{itemsCount} {itemsCount === 1 ? 'товар' : itemsCount < 5 ? 'товара' : 'товаров'}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>
                          {order.deliveryMethod === 'pickup' ? 'Самовывоз' : 
                           order.deliveryMethod === 'courier' ? 'Курьером' : 
                           order.deliveryMethod === 'post' ? 'Почта' : 'Доставка'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-foreground">
                        {order.total.toLocaleString()} ₽
                      </span>
                      <ChevronRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}