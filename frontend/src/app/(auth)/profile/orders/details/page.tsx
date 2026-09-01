'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, Image, Link } from '@/lib/next-shims';
import { 
  Loader2, 
  ArrowLeft, 
  Package, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  AlertCircle,
  Ban,
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Truck, 
  Home, 
  Building2,
  Calendar, 
  User, 
  ShoppingBag, 
  ChevronRight
} from 'lucide-react';
import { useAuth }  from '@/lib/hooks/useAuth';
import { fetchWithCsrf }  from '@/lib/csrf';

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
  orderNumber?: string;
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
  cancellationState?: 'none' | 'requested' | 'accepted' | 'rejected';
  cancellationRequestedAt?: string;
  cancellationResolvedAt?: string;
  cancellationReason?: string;
  cancellationDecisionReason?: string;
}

const cancellationLabels: Record<string, string> = {
  none: 'Не запрошена',
  requested: 'Запрошена, ожидает решения',
  accepted: 'Отмена принята',
  rejected: 'Отмена отклонена',
};

const statusMap: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Ожидает оплаты', 
    color: 'text-yellow-500', 
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    icon: <Clock className="w-4 h-4 text-yellow-500" />
  },
  paid: { 
    label: 'Оплачен, ожидает подтверждения', 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: <CheckCircle className="w-4 h-4 text-blue-500" />
  },
  confirmed: { 
    label: 'Подтверждён', 
    color: 'text-indigo-500', 
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    icon: <CheckCircle className="w-4 h-4 text-indigo-500" />
  },
  assembling: { 
    label: 'Собирается', 
    color: 'text-purple-500', 
    bg: 'bg-purple-500/10 border-purple-500/20',
    icon: <Package className="w-4 h-4 text-purple-500" />
  },
  packing: { 
    label: 'Упаковывается', 
    color: 'text-purple-500', 
    bg: 'bg-purple-500/10 border-purple-500/20',
    icon: <Package className="w-4 h-4 text-purple-500" />
  },
  shipped: { 
    label: 'Отправлен', 
    color: 'text-green-500', 
    bg: 'bg-green-500/10 border-green-500/20',
    icon: <Truck className="w-4 h-4 text-green-500" />
  },
  delivered: { 
    label: 'Доставлен', 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: <CheckCircle className="w-4 h-4 text-emerald-500" />
  },
  cancelled: { 
    label: 'Отменён', 
    color: 'text-red-500', 
    bg: 'bg-red-500/10 border-red-500/20',
    icon: <XCircle className="w-4 h-4 text-red-500" />
  },
};

export default function OrderDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!orderId || !user) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        
        const response = await fetchWithCsrf(`/api/orders/${orderId}`, {
          method: 'GET',
        });
        
        if (response.status === 401) {
          setError('Необходимо авторизоваться');
          setLoading(false);
          return;
        }

        if (response.status === 404) {
          setError('Заказ не найден');
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Ошибка: ${response.status}`);
        }

        const data = await response.json();
        setOrder(data.order || data);
        setError(null);
      } catch (error: any) {
        setError(error.message || 'Не удалось загрузить заказ');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user, authLoading]);

  const canCancel = (): boolean => {
    if (!order) return false;
    if (order.cancellationState && order.cancellationState !== 'none') return false;
    const createdAt = new Date(order.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 12;
  };

  const canPay = (): boolean => {
    if (!order) return false;
    return order.status === 'pending'
      && (!order.cancellationState || order.cancellationState === 'none');
  };

const handleCancelOrder = async () => {
  if (!order) return;
  setIsCancelling(true);
  try {
    const response = await fetchWithCsrf(`/api/orders/${order.id}/cancellation`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'customer_request' }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка запроса отмены заказа');
    }

    setOrder(data.order || data);
    setError(null);
  } catch (error: any) {
    setError(error.message || 'Не удалось запросить отмену заказа');
  } finally {
    setIsCancelling(false);
    setShowCancelConfirm(false);
  }
};

  const handlePayOrder = async () => {
    if (!order) return;
    setIsPaying(true);
    try {
      const response = await fetchWithCsrf('/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания платежа');
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        router.push(`/payment/${order.id}`);
      }
    } catch (error: any) {
      setError(error.message || 'Не удалось создать платёж');
    } finally {
      setIsPaying(false);
    }
  };

  const getStatus = (status: string) => {
    return statusMap[status] || { 
      label: status || 'Неизвестно', 
      color: 'text-gray-500', 
      bg: 'bg-gray-500/10 border-gray-500/20',
      icon: <Package className="w-4 h-4 text-gray-500" />
    };
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

  const getDeliveryLabel = (method: string) => {
    const map: Record<string, { label: string; icon: React.ReactNode }> = {
      pickup: { label: 'Самовывоз', icon: <Home className="w-4 h-4" /> },
      courier: { label: 'Курьерская доставка', icon: <Truck className="w-4 h-4" /> },
      post: { label: 'Почта России', icon: <Building2 className="w-4 h-4" /> },
    };
    return map[method] || { label: method || 'Не указан', icon: <MapPin className="w-4 h-4" /> };
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка заказа...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Требуется авторизация</h2>
            <p className="text-muted-foreground mt-2">Войдите в аккаунт, чтобы просмотреть заказ</p>
            <Link 
              href="/login?redirect=/profile/orders" 
              className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-foreground">Заказ не найден</h2>
            <p className="text-muted-foreground mt-2">{error || 'Заказ не существует или вам недоступен'}</p>
            <Link 
              href="/profile/orders" 
              className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Вернуться к заказам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const status = getStatus(order.status);
  const displayNumber = order.orderNumber || order.documentNumber || order.id.slice(0, 8);
  const isCancellable = canCancel();
  const isPayable = canPay();
  const delivery = getDeliveryLabel(order.deliveryMethod);

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-5xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/profile" className="hover:text-foreground transition">Профиль</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/profile/orders" className="hover:text-foreground transition">Заказы</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Заказ #{displayNumber}</span>
        </div>

        {/* Шапка */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Заказ #{displayNumber}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${status.bg} ${status.color}`}>
                {status.icon}
                <span className="text-sm font-medium">{status.label}</span>
              </div>
              {isPayable && (
                <button
                  onClick={handlePayOrder}
                  disabled={isPaying}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isPaying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  Оплатить
                </button>
              )}
              {isCancellable && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition border border-red-500/20"
                >
                  <Ban className="w-4 h-4" />
                  Отменить заказ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Предупреждение */}
        {isCancellable && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 text-sm text-yellow-500 flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span>Запросить отмену можно в течение 12 часов с момента создания. После передачи заказа в CRM отмена требует подтверждения.</span>
          </div>
        )}

        <div className="bg-muted border border-border rounded-lg p-4 mb-6 text-sm text-foreground">
            <p className="font-medium">
              Отмена: {cancellationLabels[order.cancellationState || 'none'] || order.cancellationState}
            </p>
            {order.cancellationDecisionReason && (
              <p className="text-muted-foreground mt-1">{order.cancellationDecisionReason}</p>
            )}
            {order.cancellationRequestedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Запрошена: {formatDate(order.cancellationRequestedAt)}
              </p>
            )}
            {order.cancellationResolvedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Решение: {formatDate(order.cancellationResolvedAt)}
              </p>
            )}
        </div>

        {/* Основная сетка */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Левая колонка */}
          <div className="lg:col-span-2 space-y-6">
            {/* Товары */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Товары</h2>
                <span className="text-sm text-muted-foreground ml-auto">
                  {order.items?.length || 0} {order.items?.length === 1 ? 'позиция' : 'позиции'}
                </span>
              </div>
              <div className="divide-y divide-border">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition">
                    <div className="w-14 h-14 bg-muted rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-contain p-1"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/logo/logo.png';
                          }}
                        />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-muted-foreground">{item.quantity} шт.</span>
                        <span className="text-muted-foreground/30">×</span>
                        <span className="text-muted-foreground">{item.price.toLocaleString()} ₽</span>
                        <span className="text-muted-foreground/30">=</span>
                        <span className="font-semibold text-foreground">
                          {(item.price * item.quantity).toLocaleString()} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            {order.comment && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">Комментарий</h2>
                </div>
                <div className="p-6">
                  <p className="text-muted-foreground text-sm leading-relaxed">{order.comment}</p>
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка */}
          <div className="lg:col-span-1 space-y-6">
            {/* Итого */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <h2 className="font-semibold text-foreground">Итого</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сумма заказа</span>
                  <span className="font-medium text-foreground">{order.total.toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-green-500 font-medium">Бесплатно</span>
                </div>
                <div className="border-t border-border pt-3 mt-1">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-foreground">Итого</span>
                    <span className="text-foreground">{order.total.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Доставка */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <Truck className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Доставка</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Способ</span>
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {delivery.icon}
                    {delivery.label}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex items-start gap-3 text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Адрес</span>
                    <span className="text-foreground font-medium break-all">{order.deliveryAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Клиент */}
            {(order.guestName || order.guestPhone || order.guestEmail) && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-semibold text-foreground">Клиент</h2>
                </div>
                <div className="p-6 space-y-3">
                  {order.guestName && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Имя</span>
                      <span className="text-foreground font-medium">{order.guestName}</span>
                    </div>
                  )}
                  {order.guestPhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${order.guestPhone}`} className="text-foreground hover:text-muted-foreground transition">
                        {order.guestPhone}
                      </a>
                    </div>
                  )}
                  {order.guestEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${order.guestEmail}`} className="text-foreground hover:text-muted-foreground transition truncate">
                        {order.guestEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Кнопка назад */}
            <Link
              href="/profile/orders"
              className="flex items-center justify-center gap-2 w-full py-3 bg-muted border border-border text-foreground rounded-lg hover:bg-muted/80 hover:border-foreground/30 transition font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться к списку заказов
            </Link>
          </div>
        </div>

        {/* Подтверждение запроса отмены */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Ban className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Отменить заказ?</h3>
                  <p className="text-sm text-muted-foreground">Заказ останется в истории</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Будет отправлен запрос на отмену заказа #{displayNumber}. После передачи в CRM отмена может быть отклонена.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-border text-foreground rounded-lg hover:bg-muted transition font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {isCancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      Запросить отмену
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
