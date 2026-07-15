// frontend/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Users, DollarSign } from 'lucide-react';
import { StatsCard } from '@/components/admin/common/StatsCard';
import { OrdersChart } from '@/components/admin/dashboard/OrdersChart';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Ошибка загрузки данных</div>
      </div>
    );
  }

  const { stats: s, charts } = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-sm text-gray-500">Общая статистика и аналитика</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Заказы"
          value={s.orders.total}
          icon={<ShoppingBag size={20} />}
          subtitle={`${s.orders.today} сегодня`}
        />
        <StatsCard
          title="Выручка"
          value={`${s.revenue.total.toLocaleString()} ₽`}
          icon={<DollarSign size={20} />}
          subtitle={`${s.revenue.month.toLocaleString()} ₽ за месяц`}
        />
        <StatsCard
          title="Пользователи"
          value={s.users.total}
          icon={<Users size={20} />}
          subtitle={`${s.users.newWeek} за неделю`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OrdersChart data={charts.ordersByDay} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Статусы заказов</h3>
          <div className="space-y-2">
            {charts.statusDistribution?.map((item: any) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{item.status}</span>
                <span className="text-sm font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Последние заказы</h3>
          {stats.recent?.orders?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent.orders.map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium">{order.guestName}</p>
                    <p className="text-xs text-gray-500">№{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {order.total.toLocaleString()} ₽
                    </p>
                    <span
                      className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${order.status === 'paid' ? 'bg-green-100 text-green-700' : ''}
                        ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${order.status === 'delivered' ? 'bg-blue-100 text-blue-700' : ''}
                        ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                      `}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Нет заказов</p>
          )}
        </div>
      </div>
    </div>
  );
}