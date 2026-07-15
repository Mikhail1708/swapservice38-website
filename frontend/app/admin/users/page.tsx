// frontend/app/admin/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Ban,
  Mail,
  Key,
  X,
  Loader2,
} from 'lucide-react';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { AddressInput } from '@/components/ui/AddressInput';
import { fetchWithCsrf, getCsrfToken } from '@/lib/csrf';

// ============================================================
// ТИПЫ
// ============================================================
interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  role: 'user' | 'manager' | 'admin';
  isVerified: boolean;
  blockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number };
}

// ============================================================
// МОДАЛЬНОЕ ОКНО СОЗДАНИЯ / РЕДАКТИРОВАНИЯ
// ============================================================
interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  user?: User | null;
  title: string;
  loading: boolean;
}

const UserModal = ({ isOpen, onClose, onSave, user, title, loading }: UserModalProps) => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'user' as 'user' | 'manager' | 'admin',
    isVerified: false,
  });

  const [phoneError, setPhoneError] = useState('');
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || '',
        password: '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        address: user.address || '',
        role: user.role || 'user',
        isVerified: user.isVerified || false,
      });
    } else {
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        role: 'user',
        isVerified: false,
      });
    }
    setPhoneError('');
    setAddressError('');
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация телефона
    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 11 || !digits.startsWith('7')) {
        setPhoneError('Введите корректный номер телефона (11 цифр)');
        return;
      }
    }
    setPhoneError('');

    // Валидация адреса (необязательно, но если есть — проверяем длину)
    if (form.address && form.address.length < 3) {
      setAddressError('Адрес слишком короткий');
      return;
    }
    setAddressError('');

    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                disabled={!!user}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
                placeholder="user@example.com"
              />
            </div>
            {user && (
              <p className="text-xs text-gray-400 mt-1">Email нельзя изменить</p>
            )}
          </div>

          {/* Пароль */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {user ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                required={!user}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder={user ? 'Оставьте пустым' : 'Минимум 6 символов'}
                minLength={6}
              />
            </div>
          </div>

          {/* Имя */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Имя
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Имя"
            />
          </div>

          {/* Фамилия */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Фамилия
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Фамилия"
            />
          </div>

          {/* Телефон с маской и валидацией */}
          <PhoneInput
            value={form.phone}
            onChange={(value) => {
              setForm({ ...form, phone: value });
              setPhoneError('');
            }}
            label="Телефон"
            placeholder="+7 (___) ___-__-__"
            error={phoneError}
          />
          <p className="text-xs text-gray-400 -mt-2">Формат: +7 (999) 999-99-99</p>

          {/* Адрес с DaData */}
          <AddressInput
            value={form.address}
            onChange={(value) => {
              setForm({ ...form, address: value });
              setAddressError('');
            }}
            onSelect={(address, data) => {
              console.log('📍 Выбран адрес:', address, data);
            }}
            label="Адрес"
            placeholder="Начните вводить адрес для автоподсказок"
            error={addressError}
          />

          {/* Роль */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="user">Пользователь</option>
              <option value="manager">Менеджер</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          {/* Верификация */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isVerified}
              onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label className="text-sm text-gray-700">Email подтверждён</label>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================
// ОСНОВНАЯ СТРАНИЦА
// ============================================================
export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Модалки
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalTitle, setModalTitle] = useState('');

  const limit = 20;

  // ============================================================
  // ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ С CSRF
  // ============================================================
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}`, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': token,
          'CSRF-Token': token,
        },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  // ============================================================
  // СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ С CSRF
  // ============================================================
  const handleCreate = () => {
    setEditingUser(null);
    setModalTitle('Создание пользователя');
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    setActionLoading(true);
    try {
      const payload = { ...data };
      
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      if (!payload.phone) delete payload.phone;
      if (!payload.address) delete payload.address;

      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const res = await fetchWithCsrf(url, {
        method,
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        setModalOpen(false);
        fetchUsers();
      } else {
        alert(result.error || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Ошибка сохранения');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // РЕДАКТИРОВАНИЕ
  // ============================================================
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setModalTitle('Редактирование пользователя');
    setModalOpen(true);
  };

  // ============================================================
  // УДАЛЕНИЕ С CSRF
  // ============================================================
  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя ${user.email}?`)) return;

    try {
      const res = await fetchWithCsrf(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Ошибка удаления');
    }
  };

  // ============================================================
  // БЛОКИРОВКА / РАЗБЛОКИРОВКА С CSRF
  // ============================================================
  const handleToggleBlock = async (user: User) => {
    const action = user.blockedAt ? 'разблокировать' : 'заблокировать';
    if (!confirm(`${action} пользователя ${user.email}?`)) return;

    try {
      const url = user.blockedAt
        ? `/api/admin/users/${user.id}/unblock`
        : `/api/admin/users/${user.id}/block`;
      
      const res = await fetchWithCsrf(url, {
        method: 'POST',
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Ошибка');
    }
  };

  // ============================================================
  // РЕНДЕР
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="text-sm text-gray-500">
            Управление пользователями сайта
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          <Plus size={16} />
          Создать
        </button>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Контакты
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Роль
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Заказы
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Пользователей не найдено
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* Пользователь */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || user.lastName || 'Без имени'}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>

                    {/* Контакты */}
                    <td className="px-4 py-3">
                      {user.phone && (
                        <div className="text-sm text-gray-700">{user.phone}</div>
                      )}
                      {user.address && (
                        <div className="text-xs text-gray-500 truncate max-w-[150px]">
                          {user.address}
                        </div>
                      )}
                      {!user.phone && !user.address && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Роль */}
                    <td className="px-4 py-3">
                      <span
                        className={`
                          text-xs px-2 py-1 rounded-full
                          ${user.role === 'admin' ? 'bg-red-100 text-red-700' : ''}
                          ${user.role === 'manager' ? 'bg-blue-100 text-blue-700' : ''}
                          ${user.role === 'user' ? 'bg-gray-100 text-gray-700' : ''}
                        `}
                      >
                        {user.role === 'admin' ? 'Администратор' : ''}
                        {user.role === 'manager' ? 'Менеджер' : ''}
                        {user.role === 'user' ? 'Пользователь' : ''}
                      </span>
                    </td>

                    {/* Статус */}
                    <td className="px-4 py-3">
                      {user.blockedAt ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                          Заблокирован
                        </span>
                      ) : !user.isVerified ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                          Не подтверждён
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                          Активен
                        </span>
                      )}
                    </td>

                    {/* Заказы */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user._count?.orders || 0}
                    </td>

                    {/* Действия */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleBlock(user)}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title={user.blockedAt ? 'Разблокировать' : 'Заблокировать'}
                        >
                          <Ban size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Показано {users.length} из {total} пользователей
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модалка */}
      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        user={editingUser}
        title={modalTitle}
        loading={actionLoading}
      />
    </div>
  );
}