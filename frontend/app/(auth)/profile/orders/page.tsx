// frontend/app/(auth)/profile/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Package, ChevronRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Order {
  id: string;
  documentNumber?: string;
  items: OrderItem[];
  total: number;
  status: string;
  deliveryMethod: string;
  deliveryAddress?: string;
  createdAt: string;
  crmOrderId?: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Оплачен, ожидает подтверждения', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Подтверждён, собирается', color: 'bg-indigo-100 text-indigo-700' },
  packing: { label: 'Собирается', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: 'Отправлен', color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        console.log('🔄 Загрузка заказов...');
        const response = await fetch('/api/orders', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Не удалось загрузить заказы');
        }

        const data = await response.json();
        console.log('✅ Заказы загружены:', data);
        setOrders(data.orders || []);
      } catch (error: any) {
        console.error('❌ Ошибка загрузки заказов:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  const getStatus = (status: string) => {
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Package className="w-6 h-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-black">Мои заказы</h1>
          <span className="text-sm text-gray-400">({orders.length})</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-black">У вас пока нет заказов</h2>
            <p className="text-gray-400 mt-2">Перейдите в каталог и сделайте свой первый заказ</p>
            <Link 
              href="/catalog" 
              className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
            >
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = getStatus(order.status);
              const itemsCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

              return (
                <Link
                  key={order.id}
                  href={`/profile/orders/${order.id}`}
                  className="block bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-gray-400 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-black">
                          Заказ #{order.documentNumber || order.id.slice(0, 8)}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span>{formatDate(order.createdAt)}</span>
                        <span className="mx-2">•</span>
                        <span>{itemsCount} {itemsCount === 1 ? 'товар' : itemsCount < 5 ? 'товара' : 'товаров'}</span>
                        <span className="mx-2">•</span>
                        <span>
                          {order.deliveryMethod === 'pickup' ? 'Самовывоз' : 
                           order.deliveryMethod === 'courier' ? 'Курьером' : 'Почта'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-black">
                        {order.total.toLocaleString()} ₽
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black transition" />
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