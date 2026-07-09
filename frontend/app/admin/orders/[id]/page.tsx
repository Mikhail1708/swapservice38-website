'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/admin/common/StatusBadge';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data.order);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-red-500">Заказ не найден</div>;
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Заказ #{order.orderNumber || order.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-gray-500">Детали заказа</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Товары</h3>
            <div className="space-y-2">
              {items.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">Кол-во: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {(item.price * item.quantity).toLocaleString()} ₽
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.price.toLocaleString()} ₽ / шт
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="font-medium">Итого</span>
                <span className="text-xl font-bold">
                  {order.total.toLocaleString()} ₽
                </span>
              </div>
            </div>
          </div>

          {order.comment && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Комментарий:</span> {order.comment}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Информация</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Статус</p>
                <StatusBadge status={order.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Клиент</p>
                <p className="text-sm font-medium">{order.guestName || 'Гость'}</p>
              </div>
              {order.guestPhone && (
                <div>
                  <p className="text-xs text-gray-500">Телефон</p>
                  <p className="text-sm">{order.guestPhone}</p>
                </div>
              )}
              {order.guestEmail && (
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm">{order.guestEmail}</p>
                </div>
              )}
              {order.deliveryAddress && (
                <div>
                  <p className="text-xs text-gray-500">Адрес доставки</p>
                  <p className="text-sm">{order.deliveryAddress}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Дата создания</p>
                <p className="text-sm">
                  {new Date(order.createdAt).toLocaleString('ru-RU')}
                </p>
              </div>
              {order.crmOrderId && (
                <div>
                  <p className="text-xs text-gray-500">ID в CRM</p>
                  <p className="text-sm">{order.crmOrderId}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Действия</h3>
            <div className="flex flex-col gap-2">
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                Изменить статус
              </button>
              <button className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                Отменить заказ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}