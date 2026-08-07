'use client';

import { useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ShoppingBag, Users, DollarSign, Package, Clock, TrendingUp, TrendingDown, Eye, ShoppingCart, UserPlus, ArrowRight } from 'lucide-react';

interface DashboardStats {
  stats: {
    orders: {
      total: number;
      today: number;
      week: number;
      month: number;
      paid: number;
      pending: number;
    };
    revenue: {
      total: number;
      month: number;
    };
    users: {
      total: number;
      newWeek: number;
      newMonth: number;
    };
  };
  charts: {
    ordersByDay: Array<{ date: string; count: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
  };
  recent: {
    orders: Array<{
      id: string;
      orderNumber: string;
      guestName: string;
      total: number;
      status: string;
      createdAt: string;
    }>;
  };
}

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  paid: 'Оплачен',
  confirmed: 'Подтверждён',
  assembling: 'Собирается',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  paid: 'bg-blue-500/20 text-blue-500',
  confirmed: 'bg-indigo-500/20 text-indigo-500',
  assembling: 'bg-purple-500/20 text-purple-500',
  shipped: 'bg-green-500/20 text-green-500',
  delivered: 'bg-emerald-500/20 text-emerald-500',
  cancelled: 'bg-red-500/20 text-red-500',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/dashboard/stats', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500">Ошибка загрузки данных</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const { stats: s, charts, recent } = stats;

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Общая статистика и аналитика</p>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-foreground/30 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего заказов</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.orders.total}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <ShoppingBag className="w-6 h-6 text-foreground" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {s.orders.today} сегодня
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {s.orders.week} за неделю
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 hover:border-foreground/30 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Выручка</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.revenue.total.toLocaleString()} ₽</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-foreground" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {s.revenue.month.toLocaleString()} ₽ за месяц
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 hover:border-foreground/30 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Пользователи</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.users.total}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Users className="w-6 h-6 text-foreground" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {s.users.newWeek} за неделю
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {s.users.newMonth} за месяц
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 hover:border-foreground/30 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ожидают обработки</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.orders.pending}</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <Link
              href="/admin/orders?status=pending"
              className="text-foreground hover:underline inline-flex items-center gap-1"
            >
              Перейти к заказам
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* График и статусы */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Динамика заказов</h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {charts.ordersByDay.map((item, index) => {
              const max = Math.max(...charts.ordersByDay.map(d => d.count), 1);
              const height = (item.count / max) * 100;
              const isToday = index === charts.ordersByDay.length - 1;
              
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className={`w-full rounded-lg transition-all duration-500 hover:opacity-80 ${
                      isToday ? 'bg-foreground' : 'bg-foreground/30'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.date).toLocaleDateString('ru-RU', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Статусы заказов</h3>
          <div className="space-y-3">
            {charts.statusDistribution.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className={`text-sm px-2 py-0.5 rounded-full ${statusColors[item.status] || 'bg-muted text-muted-foreground'}`}>
                  {statusLabels[item.status] || item.status}
                </span>
                <span className="text-sm font-medium text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Последние заказы */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Последние заказы</h3>
          <Link
            href="/admin/orders"
            className="text-sm text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
          >
            Все заказы
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {recent.orders?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">№</th>
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Клиент</th>
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Сумма</th>
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Статус</th>
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 text-sm font-medium text-foreground">
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">{order.guestName || 'Гость'}</td>
                    <td className="py-3 text-sm font-medium text-foreground">{order.total.toLocaleString()} ₽</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Заказов пока нет</p>
        )}
      </div>
    </div>
  );
}