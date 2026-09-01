'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, Image, Link } from '@/lib/next-shims';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  CreditCard,
  Truck,
  Home,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { fetchWithCsrf, deleteWithCsrf }  from '@/lib/csrf';

interface Order {
  id: string;
  orderNumber: string;
  documentNumber?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
  }>;
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
  cancellationState?: 'none' | 'requested' | 'accepted' | 'rejected';
  cancellationRequestedAt?: string;
  cancellationResolvedAt?: string;
  cancellationReason?: string;
  cancellationDecisionReason?: string;
  paymentAttempts?: Array<{
    id: string;
    status: string;
    refundReason?: string;
    refundId?: string;
    refundRequestedAt?: string;
    refundedAt?: string;
    lastError?: string;
  }>;
}

const cancellationLabels: Record<string, string> = {
  none: 'Не запрошена',
  requested: 'Ожидает решения CRM',
  accepted: 'Принята',
  rejected: 'Отклонена',
};

const statusMap: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Ожидает оплаты', 
    color: 'text-yellow-500', 
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    icon: <Clock className="w-4 h-4" />
  },
  paid: { 
    label: 'Оплачен', 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: <CreditCard className="w-4 h-4" />
  },
  confirmed: { 
    label: 'Подтверждён', 
    color: 'text-indigo-500', 
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    icon: <CheckCircle className="w-4 h-4" />
  },
  assembling: { 
    label: 'Собирается', 
    color: 'text-purple-500', 
    bg: 'bg-purple-500/10 border-purple-500/20',
    icon: <Package className="w-4 h-4" />
  },
  shipped: { 
    label: 'Отправлен', 
    color: 'text-green-500', 
    bg: 'bg-green-500/10 border-green-500/20',
    icon: <Truck className="w-4 h-4" />
  },
  delivered: { 
    label: 'Доставлен', 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: <CheckCircle className="w-4 h-4" />
  },
  cancelled: { 
    label: 'Отменён', 
    color: 'text-red-500', 
    bg: 'bg-red-500/10 border-red-500/20',
    icon: <XCircle className="w-4 h-4" />
  },
};

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayingRefund, setReplayingRefund] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Заказ не найден');
      const data = await res.json();
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const replayRefund = async () => {
    if (!order || !confirm('Повторить возврат платежа? Операция использует прежний idempotency key.')) return;
    setReplayingRefund(true);
    try {
      const res = await fetchWithCsrf(`/api/admin/orders/${order.id}/refund/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось повторить возврат');
      setOrder({
        ...order,
        paymentAttempts: data.paymentAttempt
          ? [data.paymentAttempt, ...(order.paymentAttempts || []).slice(1)]
          : order.paymentAttempts,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReplayingRefund(false);
    }
  };

  // ✅ УДАЛЕНИЕ С ПАРОЛЕМ ДЛЯ ЛЮБЫХ СТАТУСОВ
  const handleDeleteOrder = async () => {
    if (!order) return;
    
    // Если заказ можно удалить без пароля (pending, crm_failed, paid)
    const allowedWithoutPassword = ['pending', 'crm_failed', 'paid'];
    if (allowedWithoutPassword.includes(order.status)) {
      if (!confirm('Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.')) return;
      await executeDelete(null);
    } else {
      // Требуем пароль
      setShowDeletePasswordModal(true);
      setDeletePassword('');
    }
  };

  const executeDelete = async (password: string | null) => {
    if (!order) return;
    
    setIsDeleting(true);
    try {
      const body: any = {};
      if (password) {
        body.password = password;
      }
      
      const response = await fetchWithCsrf(`/api/admin/orders/${id}`, {
        method: 'DELETE',
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        setShowDeletePasswordModal(false);
        setDeletePassword('');
        router.push('/admin/orders?deleted=true');
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка удаления заказа');
      }
    } catch (error) {
      alert('Ошибка удаления заказа');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatus = (status: string) => {
    return statusMap[status] || { 
      label: status || 'Неизвестно', 
      color: 'text-gray-500', 
      bg: 'bg-gray-500/10 border-gray-500/20',
      icon: <Package className="w-4 h-4" />
    };
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeliveryLabel = (method: string) => {
    const map: Record<string, { label: string; icon: React.ReactNode }> = {
      pickup: { label: 'Самовывоз', icon: <Home className="w-4 h-4" /> },
      courier: { label: 'Курьерская доставка', icon: <Truck className="w-4 h-4" /> },
      post: { label: 'Почта России', icon: <Building2 className="w-4 h-4" /> },
    };
    return map[method] || { label: method || 'Не указан', icon: <MapPin className="w-4 h-4" /> };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-foreground">{error || 'Заказ не найден'}</p>
        <Link href="/admin/orders" className="mt-4 inline-block text-foreground hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const status = getStatus(order.status);
  const displayNumber = order.orderNumber || order.documentNumber || order.id.slice(0, 8);
  const delivery = getDeliveryLabel(order.deliveryMethod);
  const latestPaymentAttempt = order.paymentAttempts?.[0];
  const allowedWithoutPassword = ['pending', 'crm_failed', 'paid'];
  const requiresPassword = !allowedWithoutPassword.includes(order.status);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Заказ #{displayNumber}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-sm px-3 py-1 rounded-full border ${status.bg} ${status.color}`}>
              {status.icon} {status.label}
            </span>
            {order.crmOrderId && (
              <span className="text-xs text-muted-foreground">CRM ID: {order.crmOrderId}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-2 space-y-6">
          {/* Товары */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Товары
            </h3>
            <div className="space-y-3">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Кол-во: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {(item.price * item.quantity).toLocaleString()} ₽
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.price.toLocaleString()} ₽ / шт
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="font-medium text-foreground">Итого</span>
                <span className="text-xl font-bold text-foreground">
                  {order.total.toLocaleString()} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Комментарий */}
          {order.comment && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-medium text-foreground mb-2">Комментарий</h3>
              <p className="text-sm text-muted-foreground">{order.comment}</p>
            </div>
          )}
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* Информация о клиенте */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Клиент
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Имя</p>
                <p className="text-sm font-medium text-foreground">{order.guestName || 'Гость'}</p>
              </div>
              {order.guestPhone && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Телефон
                  </p>
                  <p className="text-sm text-foreground">{order.guestPhone}</p>
                </div>
              )}
              {order.guestEmail && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="text-sm text-foreground">{order.guestEmail}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Дата создания
                </p>
                <p className="text-sm text-foreground">{formatDate(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Доставка */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              Доставка
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Способ:</span>
                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                  {delivery.icon} {delivery.label}
                </span>
              </div>
              {order.deliveryAddress && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Адрес
                  </p>
                  <p className="text-sm text-foreground">{order.deliveryAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* CRM-authoritative fulfillment status */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Статус исполнения</h3>
            <div className="space-y-3">
              <div className={`px-4 py-2.5 rounded-lg border ${status.bg} ${status.color}`}>
                <span className="text-sm font-medium inline-flex items-center gap-2">
                  {status.icon} {status.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Статус поступает из CRM и недоступен для ручного изменения на сайте.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Отмена и возврат</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Запрос отмены</p>
                <p className="font-medium text-foreground">
                  {cancellationLabels[order.cancellationState || 'none'] || order.cancellationState}
                </p>
              </div>
              {order.cancellationRequestedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Запрошена</p>
                  <p className="text-foreground">{formatDate(order.cancellationRequestedAt)}</p>
                </div>
              )}
              {order.cancellationResolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Решение получено</p>
                  <p className="text-foreground">{formatDate(order.cancellationResolvedAt)}</p>
                </div>
              )}
              {order.cancellationReason && (
                <div>
                  <p className="text-xs text-muted-foreground">Основание запроса</p>
                  <p className="text-foreground break-words">{order.cancellationReason}</p>
                </div>
              )}
              {order.cancellationDecisionReason && (
                <div>
                  <p className="text-xs text-muted-foreground">Решение CRM</p>
                  <p className="text-foreground break-words">{order.cancellationDecisionReason}</p>
                </div>
              )}
              {latestPaymentAttempt && (
                <>
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Платёж / возврат</p>
                    <p className="font-medium text-foreground">{latestPaymentAttempt.status}</p>
                  </div>
                  {latestPaymentAttempt.refundReason && (
                    <p className="text-xs text-muted-foreground break-words">
                      Основание возврата: {latestPaymentAttempt.refundReason}
                    </p>
                  )}
                  {latestPaymentAttempt.refundId && (
                    <p className="text-xs text-muted-foreground break-all">
                      Refund ID: {latestPaymentAttempt.refundId}
                    </p>
                  )}
                  {latestPaymentAttempt.refundRequestedAt && (
                    <p className="text-xs text-muted-foreground">
                      Запрошен: {formatDate(latestPaymentAttempt.refundRequestedAt)}
                    </p>
                  )}
                  {latestPaymentAttempt.refundedAt && (
                    <p className="text-xs text-muted-foreground">
                      Завершён: {formatDate(latestPaymentAttempt.refundedAt)}
                    </p>
                  )}
                  {latestPaymentAttempt.lastError && (
                    <p className="text-xs text-red-500 break-words">{latestPaymentAttempt.lastError}</p>
                  )}
                  {latestPaymentAttempt.status === 'refund_failed' && (
                    <button
                      onClick={replayRefund}
                      disabled={replayingRefund}
                      className="w-full px-4 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {replayingRefund && <Loader2 className="w-4 h-4 animate-spin" />}
                      {replayingRefund ? 'Повтор возврата...' : 'Повторить возврат'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ✅ ОПАСНАЯ ЗОНА — УДАЛЕНИЕ */}
          <div className="bg-card border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-red-500 mb-4 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Опасная зона
            </h3>
            {requiresPassword && (
              <p className="text-xs text-muted-foreground mb-3">
                ⚠️ Для удаления заказа в статусе <strong>{status.label}</strong> требуется ввод пароля.
              </p>
            )}
            <button
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? 'Удаление...' : 'Удалить заказ'}
            </button>
            <p className="text-xs text-muted-foreground/60 mt-2 text-center">
              Это действие нельзя отменить. Заказ будет полностью удалён.
            </p>
          </div>
        </div>
      </div>

      {/* ✅ МОДАЛКА ПОДТВЕРЖДЕНИЯ ПАРОЛЯ ДЛЯ УДАЛЕНИЯ ОДНОГО ЗАКАЗА */}
      {showDeletePasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground mb-2">Подтверждение удаления</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Заказ #{displayNumber} находится в статусе <strong>{status.label}</strong>.
              Введите пароль администратора для подтверждения удаления.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Пароль администратора
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Введите пароль..."
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      executeDelete(deletePassword);
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeletePasswordModal(false);
                    setDeletePassword('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => executeDelete(deletePassword)}
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
