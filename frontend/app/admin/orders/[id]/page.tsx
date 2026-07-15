// frontend/app/admin/orders/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Save, Loader2, X, Edit3, User, Phone, Mail, MapPin, 
  Package, CreditCard, Trash2, AlertCircle, Eye, EyeOff 
} from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

// Статусы заказов
const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ Ожидает оплаты', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  paid: { label: '✅ Оплачен', color: 'text-blue-700', bg: 'bg-blue-50' },
  confirmed: { label: '📦 Подтверждён', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  assembling: { label: '🔧 Собирается', color: 'text-purple-700', bg: 'bg-purple-50' },
  shipped: { label: '🚚 Отправлен', color: 'text-green-700', bg: 'bg-green-50' },
  delivered: { label: '✅ Доставлен', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelled: { label: '❌ Отменён', color: 'text-red-700', bg: 'bg-red-50' },
};

// ============================================================
// МОДАЛЬНОЕ ОКНО УДАЛЕНИЯ С ПАРОЛЕМ
// ============================================================
interface DeleteOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  orderNumber: string;
  isLoading: boolean;
  error?: string | null;
}

function DeleteOrderModal({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  isLoading,
  error,
}: DeleteOrderModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useState<HTMLInputElement | null>(null)[0];

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setLocalError(null);
      setTimeout(() => {
        const input = document.getElementById('delete-password-input') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      setLocalError('Введите пароль (минимум 6 символов)');
      return;
    }

    setLocalError(null);
    await onConfirm(password);
  };

  if (!isOpen) return null;

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Удаление заказа</h2>
              <p className="text-sm text-gray-500">Заказ #{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Тело */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  Вы уверены, что хотите удалить этот заказ?
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Это действие нельзя отменить. Заказ будет полностью удалён из системы.
                </p>
              </div>
            </div>
          </div>

          {displayError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Введите пароль для подтверждения
            </label>
            <div className="relative">
              <input
                id="delete-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                placeholder="Введите пароль..."
                className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Пароль нужен для подтверждения удаления заказа
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Удалить заказ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// ОСНОВНАЯ СТРАНИЦА
// ============================================================
export default function AdminOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Состояние редактирования
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    deliveryAddress: '',
    comment: '',
    deliveryMethod: 'courier',
  });
  const [editItems, setEditItems] = useState<any[]>([]);

  // ✅ СОСТОЯНИЯ ДЛЯ УДАЛЕНИЯ С ПАРОЛЕМ
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      if (!res.ok) throw new Error('Заказ не найден');
      const data = await res.json();
      setOrder(data.order);
      // Заполняем форму текущими данными
      setEditForm({
        guestName: data.order.guestName || '',
        guestPhone: data.order.guestPhone || '',
        guestEmail: data.order.guestEmail || '',
        deliveryAddress: data.order.deliveryAddress || '',
        comment: data.order.comment || '',
        deliveryMethod: data.order.deliveryMethod || 'courier',
      });
      setEditItems(data.order.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        guestName: editForm.guestName,
        guestPhone: editForm.guestPhone,
        guestEmail: editForm.guestEmail,
        deliveryAddress: editForm.deliveryAddress,
        comment: editForm.comment,
        deliveryMethod: editForm.deliveryMethod,
        items: editItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const res = await fetchWithCsrf(`/api/admin/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setOrder(data.order);
        setIsEditing(false);
        alert('✅ Заказ обновлён');
        // Обновляем данные
        await fetchOrder();
      } else {
        setError(data.error || 'Ошибка обновления');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  // ✅ ОБРАБОТЧИК УДАЛЕНИЯ С ПАРОЛЕМ
  const handleDeleteWithPassword = async (password: string) => {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const response = await fetchWithCsrf(`/api/admin/orders/${id}/delete-with-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка удаления заказа');
      }

      // ✅ УСПЕШНОЕ УДАЛЕНИЕ — ПЕРЕХОДИМ К СПИСКУ
      setDeleteModalOpen(false);
      router.push('/admin/orders?deleted=true');
    } catch (err: any) {
      setDeleteError(err.message);
      // Если ошибка "Неверный пароль" — оставляем модалку открытой
      if (err.message === 'Неверный пароль') {
        setDeleteError('Неверный пароль. Попробуйте снова.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...editItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditItems(newItems);
  };

  const addItem = () => {
    setEditItems([...editItems, { productId: '', quantity: 1, price: 0, name: 'Новый товар' }]);
  };

  const removeItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const getStatus = (status: string) => {
    return statusMap[status] || { label: status || 'Неизвестно', color: 'text-gray-700', bg: 'bg-gray-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <button onClick={() => router.push('/admin/orders')} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">
          Вернуться к списку
        </button>
      </div>
    );
  }

  if (!order) {
    return <div className="text-center py-12 text-gray-500">Заказ не найден</div>;
  }

  const status = getStatus(order.status);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => router.push('/admin/orders')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Заказ #{order.orderNumber || order.id.slice(0, 8)}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-sm px-3 py-1 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            {order.crmOrderId && (
              <span className="text-xs text-gray-400">CRM ID: {order.crmOrderId}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                <Edit3 size={16} />
                Редактировать
              </button>
              {/* ✅ КНОПКА УДАЛЕНИЯ С ПАРОЛЕМ */}
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                <Trash2 size={16} />
                Удалить
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                Сохранить
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Отмена
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Основная сетка */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Товары */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Package size={18} />
              Товары
            </h3>
            {!isEditing ? (
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400">Нет товаров</p>
                ) : (
                  items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
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
                  ))
                )}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-2">
                  <span className="font-medium">Итого</span>
                  <span className="text-xl font-bold text-black">
                    {order.total.toLocaleString()} ₽
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {editItems.map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 border-b border-gray-100 pb-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Название"
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      className="flex-1 min-w-[100px] px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Кол-во"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Цена"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addItem}
                  className="text-sm text-gray-600 hover:text-gray-800 border border-dashed border-gray-300 rounded-lg px-4 py-2 w-full"
                >
                  + Добавить товар
                </button>
              </div>
            )}
          </div>

          {/* Комментарий */}
          {!isEditing ? (
            order.comment && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Комментарий:</span> {order.comment}
                </p>
              </div>
            )
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
              <textarea
                value={editForm.comment}
                onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <User size={18} />
              Информация
            </h3>
            <div className="space-y-3">
              {!isEditing ? (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Клиент</p>
                    <p className="text-sm font-medium">{order.guestName || 'Гость'}</p>
                  </div>
                  {order.guestPhone && (
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12} /> Телефон</p>
                      <p className="text-sm">{order.guestPhone}</p>
                    </div>
                  )}
                  {order.guestEmail && (
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12} /> Email</p>
                      <p className="text-sm">{order.guestEmail}</p>
                    </div>
                  )}
                  {order.deliveryAddress && (
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12} /> Адрес</p>
                      <p className="text-sm">{order.deliveryAddress}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Дата создания</p>
                    <p className="text-sm">{new Date(order.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium">Клиент</label>
                    <input
                      type="text"
                      value={editForm.guestName}
                      onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium">Телефон</label>
                    <input
                      type="text"
                      value={editForm.guestPhone}
                      onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium">Email</label>
                    <input
                      type="email"
                      value={editForm.guestEmail}
                      onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium">Адрес доставки</label>
                    <input
                      type="text"
                      value={editForm.deliveryAddress}
                      onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium">Способ доставки</label>
                    <select
                      value={editForm.deliveryMethod}
                      onChange={(e) => setEditForm({ ...editForm, deliveryMethod: e.target.value })}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="pickup">Самовывоз</option>
                      <option value="courier">Курьер</option>
                      <option value="post">Почта</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ МОДАЛКА УДАЛЕНИЯ С ПАРОЛЕМ */}
      <DeleteOrderModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteWithPassword}
        orderNumber={order.orderNumber || order.id.slice(0, 8)}
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}