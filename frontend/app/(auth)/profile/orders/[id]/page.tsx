// frontend/app/(auth)/profile/orders/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft, Package, MapPin, Phone, Mail, Clock } from 'lucide-react';

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
  comment?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  createdAt: string;
  crmOrderId?: string;
}

const statusMap: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  paid: { label: 'Оплачен, ожидает подтверждения', color: 'bg-blue-100 text-blue-700', icon: '✅' },
  confirmed: { label: 'Подтверждён, собирается', color: 'bg-indigo-100 text-indigo-700', icon: '📦' },
  packing: { label: 'Собирается', color: 'bg-purple-100 text-purple-700', icon: '📦' },
  shipped: { label: 'Отправлен', color: 'bg-green-100 text-green-700', icon: '🚚' },
  delivered: { label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: '❌' },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        console.log('🔄 Загрузка заказа:', orderId);
        const response = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Заказ не найден');
        }

        const data = await response.json();
        console.log('✅ Заказ загружен:', data);
        setOrder(data.order || data);
      } catch (error: any) {
        console.error('❌ Ошибка загрузки заказа:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const getStatus = (status: string) => {
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: '📋' };
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

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-black">Заказ не найден</h2>
            <p className="text-gray-400 mt-2">{error || 'Заказ не существует или вам недоступен'}</p>
            <Link 
              href="/profile/orders" 
              className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
            >
              Вернуться к заказам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const status = getStatus(order.status);

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Назад */}
        <Link 
          href="/profile/orders" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к заказам
        </Link>

        {/* Заголовок */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-black">
              Заказ #{order.documentNumber || order.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              от {formatDate(order.createdAt)}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Информация о заказе */}
          <div className="md:col-span-2 space-y-6">
            {/* Товары */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h2 className="font-medium text-black mb-4">Товары</h2>
              <div className="space-y-4">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={item.image || '/images/placeholder.svg'}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black line-clamp-2">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} × {item.price.toLocaleString()} ₽
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-bold text-black">
                        {(item.price * item.quantity).toLocaleString()} ₽
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            {order.comment && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="font-medium text-black mb-2">Комментарий к заказу</h2>
                <p className="text-gray-500 text-sm">{order.comment}</p>
              </div>
            )}
          </div>

          {/* Информация о доставке и клиенте */}
          <div className="md:col-span-1 space-y-6">
            {/* Доставка */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h2 className="font-medium text-black mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                Доставка
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Способ:</span>
                  <span className="font-medium">
                    {order.deliveryMethod === 'pickup' ? 'Самовывоз' : 
                     order.deliveryMethod === 'courier' ? 'Курьером' : 'Почта России'}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Адрес:</span>
                    <span className="font-medium text-right">{order.deliveryAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Клиент */}
            {(order.guestName || order.guestPhone || order.guestEmail) && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="font-medium text-black mb-4">Клиент</h2>
                <div className="space-y-2 text-sm">
                  {order.guestName && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">👤</span>
                      <span>{order.guestName}</span>
                    </div>
                  )}
                  {order.guestPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{order.guestPhone}</span>
                    </div>
                  )}
                  {order.guestEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{order.guestEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Итого */}
            <div className="bg-black text-white rounded-2xl p-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Товары:</span>
                  <span>{order.total.toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Доставка:</span>
                  <span>Бесплатно</span>
                </div>
                <div className="border-t border-gray-700 pt-3 mt-2 flex justify-between text-lg font-bold">
                  <span>Итого:</span>
                  <span>{order.total.toLocaleString()} ₽</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}