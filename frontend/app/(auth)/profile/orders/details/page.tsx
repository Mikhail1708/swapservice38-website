// frontend/app/(auth)/profile/orders/details/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Loader2, ArrowLeft, Package, MapPin, Phone, Mail, Clock, AlertCircle,
  Trash2, CreditCard, CheckCircle, XCircle, Truck, Home, Building2,
  Calendar, User, ShoppingBag, ChevronRight
} from 'lucide-react';
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
}

const statusMap: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Ожидает оплаты', 
    color: 'text-yellow-700', 
    bg: 'bg-yellow-50 border-yellow-200',
    icon: <Clock className="w-4 h-4 text-yellow-500" />
  },
  paid: { 
    label: 'Оплачен, ожидает подтверждения', 
    color: 'text-blue-700', 
    bg: 'bg-blue-50 border-blue-200',
    icon: <CheckCircle className="w-4 h-4 text-blue-500" />
  },
  confirmed: { 
    label: 'Подтверждён', 
    color: 'text-indigo-700', 
    bg: 'bg-indigo-50 border-indigo-200',
    icon: <CheckCircle className="w-4 h-4 text-indigo-500" />
  },
  assembling: { 
    label: 'Собирается', 
    color: 'text-purple-700', 
    bg: 'bg-purple-50 border-purple-200',
    icon: <Package className="w-4 h-4 text-purple-500" />
  },
  packing: { 
    label: 'Упаковывается', 
    color: 'text-purple-700', 
    bg: 'bg-purple-50 border-purple-200',
    icon: <Package className="w-4 h-4 text-purple-500" />
  },
  shipped: { 
    label: 'Отправлен', 
    color: 'text-green-700', 
    bg: 'bg-green-50 border-green-200',
    icon: <Truck className="w-4 h-4 text-green-500" />
  },
  delivered: { 
    label: 'Доставлен', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-50 border-emerald-200',
    icon: <CheckCircle className="w-4 h-4 text-emerald-500" />
  },
  cancelled: { 
    label: 'Отменён', 
    color: 'text-red-700', 
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="w-4 h-4 text-red-500" />
  },
};

export default function OrderDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        
        const response = await fetch(`/api/orders/details?id=${orderId}`, {
          credentials: 'include',
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

  const canDelete = (): boolean => {
    if (!order) return false;
    if (order.status !== 'pending') return false;
    const createdAt = new Date(order.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 12;
  };

  const canPay = (): boolean => {
    if (!order) return false;
    return order.status === 'pending';
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/orders/delete?id=${order.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка удаления заказа');
      }

      router.push('/profile/orders?deleted=true');
    } catch (error: any) {
      setError(error.message || 'Не удалось удалить заказ');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePayOrder = async () => {
    if (!order) return;
    setIsPaying(true);
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
        credentials: 'include',
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
      color: 'text-gray-700', 
      bg: 'bg-gray-50 border-gray-200',
      icon: <Package className="w-4 h-4 text-gray-400" />
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Загрузка заказа...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-20">
        <div className="container-custom max-w-2xl mx-auto px-4">
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-black">Требуется авторизация</h2>
            <p className="text-gray-400 mt-2">Войдите в аккаунт, чтобы просмотреть заказ</p>
            <Link 
              href="/login?redirect=/profile/orders" 
              className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
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
      <div className="min-h-screen bg-gray-50 pt-32 pb-20">
        <div className="container-custom max-w-2xl mx-auto px-4">
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
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
  const displayNumber = order.orderNumber || order.documentNumber || order.id.slice(0, 8);
  const isPending = order.status === 'pending';
  const isDeletable = canDelete();
  const isPayable = canPay();
  const delivery = getDeliveryLabel(order.deliveryMethod);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <div className="container-custom max-w-5xl mx-auto px-4">
        {/* ===== ХЛЕБНЫЕ КРОШКИ ===== */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/profile" className="hover:text-black transition">Профиль</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/profile/orders" className="hover:text-black transition">Заказы</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-black font-medium">Заказ #{displayNumber}</span>
        </div>

        {/* ===== ШАПКА ===== */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-black">
                Заказ #{displayNumber}
              </h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
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
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isPaying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  Оплатить
                </button>
              )}
              {isDeletable && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== ПРЕДУПРЕЖДЕНИЕ ===== */}
        {isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-700 flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span>Заказ можно удалить в течение 12 часов с момента создания.</span>
          </div>
        )}

        {/* ===== ОСНОВНАЯ СЕТКА ===== */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ===== ЛЕВАЯ КОЛОНКА ===== */}
          <div className="lg:col-span-2 space-y-6">
            {/* ТОВАРЫ */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold text-black">Товары</h2>
                <span className="text-sm text-gray-400 ml-auto">
                  {order.items?.length || 0} {order.items?.length === 1 ? 'позиция' : 'позиции'}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition">
                    <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                        <Package className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black text-sm line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-gray-400">{item.quantity} шт.</span>
                        <span className="text-gray-300">×</span>
                        <span className="text-gray-400">{item.price.toLocaleString()} ₽</span>
                        <span className="text-gray-300">=</span>
                        <span className="font-semibold text-black">
                          {(item.price * item.quantity).toLocaleString()} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* КОММЕНТАРИЙ */}
            {order.comment && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-black">Комментарий</h2>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 text-sm leading-relaxed">{order.comment}</p>
                </div>
              </div>
            )}
          </div>

          {/* ===== ПРАВАЯ КОЛОНКА ===== */}
          <div className="lg:col-span-1 space-y-6">
            {/* ИТОГО */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                <h2 className="font-semibold text-black">Итого</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Сумма заказа</span>
                  <span className="font-medium text-black">{order.total.toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Доставка</span>
                  <span className="text-green-600 font-medium">Бесплатно</span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-1">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-black">Итого</span>
                    <span className="text-black">{order.total.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ДОСТАВКА */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <Truck className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold text-black">Доставка</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">Способ</span>
                  <span className="flex items-center gap-2 font-medium text-black">
                    {delivery.icon}
                    {delivery.label}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex items-start gap-3 text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-400">Адрес</span>
                    <span className="text-black font-medium break-all">{order.deliveryAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* КЛИЕНТ */}
            {(order.guestName || order.guestPhone || order.guestEmail) && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold text-black">Клиент</h2>
                </div>
                <div className="p-6 space-y-3">
                  {order.guestName && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">Имя</span>
                      <span className="text-black font-medium">{order.guestName}</span>
                    </div>
                  )}
                  {order.guestPhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${order.guestPhone}`} className="text-black hover:text-gray-600 transition">
                        {order.guestPhone}
                      </a>
                    </div>
                  )}
                  {order.guestEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${order.guestEmail}`} className="text-black hover:text-gray-600 transition truncate">
                        {order.guestEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* КНОПКА НАЗАД */}
            <Link
              href="/profile/orders"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-medium text-sm shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться к списку заказов
            </Link>
          </div>
        </div>

        {/* ===== МОДАЛ УДАЛЕНИЯ ===== */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black">Удалить заказ?</h3>
                  <p className="text-sm text-gray-400">Это действие нельзя отменить</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Заказ #{displayNumber} будет безвозвратно удалён. Вы уверены?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteOrder}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Удалить
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