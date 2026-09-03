'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, Image, Link } from '@/lib/next-shims';
import { 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  X, 
  Loader2,
  ChevronDown,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { fetchWithCsrf, deleteWithCsrf }  from '@/lib/csrf';

interface Order {
  id: string;
  orderNumber: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  total: number;
  status: string;
  paymentStarted?: boolean;
  createdAt: string;
  crmOrderId?: string;
}

const statusOptions = [
  { value: 'pending', label: 'Ожидает оплаты' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'assembling', label: 'Собирается' },
  { value: 'shipped', label: 'Отправлен' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'cancelled', label: 'Отменён' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  paid: 'bg-blue-500/20 text-blue-500',
  confirmed: 'bg-indigo-500/20 text-indigo-500',
  assembling: 'bg-purple-500/20 text-purple-500',
  shipped: 'bg-green-500/20 text-green-500',
  delivered: 'bg-emerald-500/20 text-emerald-500',
  cancelled: 'bg-red-500/20 text-red-500',
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  // ✅ ДЛЯ ЧЕКБОКСОВ
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isMassAction, setIsMassAction] = useState(false);
  
  // ✅ ДЛЯ МОДАЛКИ С ПАРОЛЕМ
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [massDeletePassword, setMassDeletePassword] = useState('');
  const [isMassDeletingWithPassword, setIsMassDeletingWithPassword] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter, search]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/orders?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки заказов');
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setSelectedOrders(new Set());
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
    fetchOrders();
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

  const getStatusLabel = (status: string) => {
    return statusOptions.find(s => s.value === status)?.label || status;
  };

  // ✅ ЧЕКБОКСЫ
  const selectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOrders(newSet);
  };

  // ✅ МАССОВОЕ УДАЛЕНИЕ — ПРОВЕРЯЕМ СТАТУСЫ
  const handleMassDelete = async () => {
    if (selectedOrders.size === 0) return;
    
    const ids = Array.from(selectedOrders);
    const selectedOrdersData = orders.filter(o => ids.includes(o.id));
    const hasStartedPayment = selectedOrdersData.some(o => o.paymentStarted);
    
    // Проверяем, есть ли заказы, которые нельзя удалить без пароля
    const hasNonDeletable = selectedOrdersData.some(o => 
      o.status !== 'pending' && o.status !== 'crm_failed' && o.status !== 'paid'
    );
    
    if (hasNonDeletable) {
      // Показываем модалку с паролем
      setShowPasswordModal(true);
      setMassDeletePassword('');
    } else {
      // Можно удалить без пароля
      const paymentWarning = hasStartedPayment
        ? ' Заказы с начатой оплатой будут пропущены.'
        : '';
      if (!confirm(`Удалить ${selectedOrders.size} заказов? Это действие нельзя отменить.${paymentWarning}`)) return;
      await executeMassDelete(null);
    }
  };

  // ✅ ВЫПОЛНЕНИЕ МАССОВОГО УДАЛЕНИЯ
  const executeMassDelete = async (password: string | null) => {
    setIsMassAction(true);
    setIsMassDeletingWithPassword(Boolean(password));
    try {
      const ids = Array.from(selectedOrders);
      const body: any = { ids };
      if (password) {
        body.password = password;
      }
      
      const url = password 
        ? '/api/admin/orders/mass-delete-with-password'
        : '/api/admin/orders/mass-delete';
      
      const response = await fetchWithCsrf(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      
      const data = await response.json().catch(() => null) as {
        error?: unknown;
        message?: unknown;
        skipped?: unknown;
        reasons?: unknown;
      } | null;

      if (response.ok) {
        setSelectedOrders(new Set());
        setShowPasswordModal(false);
        setMassDeletePassword('');
        await fetchOrders();

        const skippedDetails = Array.isArray(data?.skipped)
          ? data.skipped
          : Array.isArray(data?.reasons)
            ? data.reasons
            : [];
        const skippedCount = Array.isArray(data?.skipped)
          ? data.skipped.length
          : typeof data?.skipped === 'number'
            ? data.skipped
            : skippedDetails.length;

        if (skippedCount > 0) {
          const reasons = skippedDetails.map((item) => {
            if (typeof item === 'string') return item;
            if (!item || typeof item !== 'object') return null;
            const skipped = item as { id?: unknown; orderNumber?: unknown; reason?: unknown };
            const orderLabel = typeof skipped.orderNumber === 'string'
              ? `Заказ ${skipped.orderNumber}`
              : typeof skipped.id === 'string'
                ? `Заказ ${skipped.id}`
                : 'Заказ';
            return typeof skipped.reason === 'string'
              ? `${orderLabel}: ${skipped.reason}`
              : orderLabel;
          }).filter((item): item is string => Boolean(item));
          const summary = typeof data?.message === 'string'
            ? data.message
            : `Не удалено заказов: ${skippedCount}`;
          alert([summary, ...reasons].join('\n'));
        }
      } else {
        alert(typeof data?.error === 'string' && data.error
          ? data.error
          : 'Ошибка массового удаления');
      }
    } catch (error) {
      alert('Ошибка массового удаления');
    } finally {
      setIsMassAction(false);
      setIsMassDeletingWithPassword(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка заказов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Заказы</h1>
          <p className="text-sm text-muted-foreground">Управление заказами</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              showFilters || statusFilter || search
                ? 'bg-foreground text-background'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            <Filter className="w-4 h-4" />
            Фильтры
            {(statusFilter || search) && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary/20 text-xs flex items-center justify-center">
                {(statusFilter ? 1 : 0) + (search ? 1 : 0)}
              </span>
            )}
          </button>
          {(statusFilter || search) && (
            <button
              onClick={clearFilters}
              className="p-2 text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Фильтры */}
      {showFilters && (
        <div className="bg-card border border-border rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Поиск по номеру или клиенту..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              >
                <option value="">Все статусы</option>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
            >
              Применить
            </button>
          </form>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Таблица */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-border bg-muted text-foreground focus:ring-foreground/20"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  № заказа
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Заказов не найдено
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="w-4 h-4 rounded border-border bg-muted text-foreground focus:ring-foreground/20"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {order.guestName || 'Гость'}
                      </div>
                      {order.guestPhone && (
                        <div className="text-xs text-muted-foreground">{order.guestPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {order.total.toLocaleString()} ₽
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Показано {orders.length} из {total} заказов
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm text-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ ПАНЕЛЬ МАССОВЫХ ДЕЙСТВИЙ */}
      {selectedOrders.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm text-foreground font-medium">
            Выбрано: {selectedOrders.size}
          </span>
          <button
            onClick={handleMassDelete}
            disabled={isMassAction}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isMassAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить выбранные
          </button>
          <button
            onClick={() => setSelectedOrders(new Set())}
            className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
          >
            Отмена
          </button>
        </div>
      )}

      {/* ✅ МОДАЛКА ПОДТВЕРЖДЕНИЯ ПАРОЛЯ ДЛЯ МАССОВОГО УДАЛЕНИЯ */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground mb-2">Подтверждение удаления</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Вы пытаетесь удалить заказы в статусах, требующих подтверждения. 
              Введите пароль администратора для подтверждения.
            </p>
            {orders.some(order => selectedOrders.has(order.id) && order.paymentStarted) && (
              <p className="text-sm text-red-500 mb-4">
                Заказы с начатой оплатой будут пропущены независимо от введённого пароля.
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Пароль администратора
                </label>
                <input
                  type="password"
                  value={massDeletePassword}
                  onChange={(e) => setMassDeletePassword(e.target.value)}
                  placeholder="Введите пароль..."
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      executeMassDelete(massDeletePassword);
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setMassDeletePassword('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => executeMassDelete(massDeletePassword)}
                  disabled={isMassDeletingWithPassword || !massDeletePassword}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isMassDeletingWithPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
