// frontend/app/(auth)/profile/orders/details/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Loader2, ArrowLeft, Package, MapPin, Phone, Mail, Clock, AlertCircle,
  Trash2, Edit3, CreditCard, X
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

const statusMap: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  paid: { label: 'Оплачен, ожидает подтверждения', color: 'bg-blue-100 text-blue-700', icon: '✅' },
  confirmed: { label: 'Подтверждён, собирается', color: 'bg-indigo-100 text-indigo-700', icon: '📦' },
  assembling: { label: 'Собирается', color: 'bg-purple-100 text-purple-700', icon: '🔧' },
  packing: { label: 'Собирается', color: 'bg-purple-100 text-purple-700', icon: '🔧' },
  shipped: { label: 'Отправлен', color: 'bg-green-100 text-green-700', icon: '🚚' },
  delivered: { label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: '❌' },
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
    if (!orderId || authLoading) return;

    const fetchOrder = async () => {
      try {
        console.log('🔄 Загрузка заказа:', orderId);
        
        const response = await fetch(`/api/orders/details?id=${orderId}`, {
          credentials: 'include',
        });
        
        console.log('📦 Статус ответа:', response.status);

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
        console.log('✅ Заказ загружен:', data);
        setOrder(data.order || data);
      } catch (error: any) {
        console.error('❌ Ошибка загрузки заказа:', error);
        setError(error.message || 'Не удалось загрузить заказ');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrder();
    } else {
      setLoading(false);
    }
  }, [orderId, user, authLoading]);

  const canEdit = (): boolean => {
    if (!order) return false;
    if (order.status !== 'pending') return false;
    
    const createdAt = new Date(order.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 12;
  };

  const canDelete = (): boolean => {
    if (!order) return false;
    return order.status === 'pending';
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
      console.error('❌ Ошибка удаления заказа:', error);
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
      console.error('❌ Ошибка оплаты:', error);
      setError(error.message || 'Не удалось создать платёж');
    } finally {
      setIsPaying(false);
    }
  };

  const getStatus = (status: string) => {
    return statusMap[status] || { label: status || 'Неизвестно', color: 'bg-gray-100 text-gray-700', icon: '📋' };
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

  const backUrl = searchParams.get('back') || '/profile/orders';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16">
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
  const displayNumber = order.orderNumber || order.documentNumber || order.id.slice(0, 8);
  const isPending = order.status === 'pending';
  const isEditable = canEdit();
  const isDeletable = canDelete();
  const isPayable = canPay();

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Link 
            href={backUrl}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к заказам
          </Link>

          <div className="flex gap-2">
            {isPayable && (
              <button
                onClick={handlePayOrder}
                disabled={isPaying}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {isPaying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Оплатить
              </button>
            )}

            {isEditable && (
              <Link
                href={`/profile/orders/edit?id=${order.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                <Edit3 className="w-4 h-4" />
                Редактировать
              </Link>
            )}

            {isDeletable && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>

                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                      <h3 className="text-xl font-bold text-black mb-2">Удалить заказ?</h3>
                      <p className="text-gray-500 text-sm mb-6">
                        Заказ #{displayNumber} будет безвозвратно удалён. Вы уверены?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={handleDeleteOrder}
                          disabled={isDeleting}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
              </>
            )}
          </div>
        </div>

        {isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-700 flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            {isEditable ? (
              <span>Заказ можно отредактировать в течение 12 часов с момента создания.</span>
            ) : (
              <span>Время на редактирование заказа истекло (12 часов).</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-black">
              Заказ #{displayNumber}
            </h1>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              от {formatDate(order.createdAt)}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h2 className="font-medium text-black mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                Товары
              </h2>
              <div className="space-y-4">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={item.image || '/images/logo/logo.png'}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-contain p-1"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black line-clamp-2 text-sm">{item.name}</p>
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

            {order.comment && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="font-medium text-black mb-2">Комментарий к заказу</h2>
                <p className="text-gray-500 text-sm">{order.comment}</p>
              </div>
            )}
          </div>

          <div className="md:col-span-1 space-y-6">
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
                     order.deliveryMethod === 'courier' ? 'Курьером' : 
                     order.deliveryMethod === 'post' ? 'Почта России' : order.deliveryMethod || 'Не указан'}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Адрес:</span>
                    <span className="font-medium text-right break-all max-w-[180px]">{order.deliveryAddress}</span>
                  </div>
                )}
              </div>
            </div>

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
                      <span className="truncate max-w-[150px]">{order.guestEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

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