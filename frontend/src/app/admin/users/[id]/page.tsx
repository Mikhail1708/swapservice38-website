'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, Image, Link } from '@/lib/next-shims';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  X, 
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  User,
  Shield,
  CheckCircle,
  Ban
} from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';

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
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'user' as 'user' | 'manager' | 'admin',
    isVerified: false,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${id}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Ошибка загрузки пользователя');
        }

        const data = await response.json();
        const userData = data.user;
        setUser(userData);
        setForm({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || '',
          address: userData.address || '',
          role: userData.role || 'user',
          isVerified: userData.isVerified || false,
        });
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки пользователя');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithCsrf(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Пользователь обновлён');
        setTimeout(() => router.push('/admin/users'), 1500);
      } else {
        setError(data.error || 'Ошибка обновления');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления');
    } finally {
      setSaving(false);
    }
  };

  // ✅ БЛОКИРОВКА/РАЗБЛОКИРОВКА
  const handleBlockToggle = async () => {
    if (!user) return;
    const action = user.blockedAt ? 'разблокировать' : 'заблокировать';
    if (!confirm(`${action} пользователя ${user.email}?`)) return;

    try {
      const url = user.blockedAt
        ? `/api/admin/users/${id}/unblock`
        : `/api/admin/users/${id}/block`;
      
      const response = await fetchWithCsrf(url, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        router.push('/admin/users');
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка');
      }
    } catch (error) {
      alert('Ошибка');
    }
  };

  // ✅ УДАЛЕНИЕ
  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Удалить пользователя ${user.email}? Это действие нельзя отменить.`)) return;
    if (!confirm('Вы уверены?')) return;

    try {
      const response = await fetchWithCsrf(`/api/admin/users/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        router.push('/admin/users');
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      alert('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка пользователя...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-foreground">Пользователь не найден</p>
        <Link href="/admin/users" className="mt-4 inline-block text-foreground hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактирование пользователя</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {user.blockedAt && (
          <span className="ml-auto text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-500">
            Заблокирован
          </span>
        )}
      </div>

      {/* Статус */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`text-xs px-3 py-1 rounded-full ${
          user.isVerified 
            ? 'bg-green-500/20 text-green-500' 
            : 'bg-yellow-500/20 text-yellow-500'
        }`}>
          {user.isVerified ? '✅ Email подтверждён' : '⏳ Email не подтверждён'}
        </span>
        <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
          Роль: {user.role === 'admin' ? 'Администратор' : user.role === 'manager' ? 'Менеджер' : 'Пользователь'}
        </span>
        <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
          Зарегистрирован: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
        </span>
      </div>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Форма */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Имя
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              placeholder="Имя"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Фамилия
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              placeholder="Фамилия"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Phone className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Телефон
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            placeholder="+7 (999) 999-99-99"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <MapPin className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Адрес
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            placeholder="г. Иркутск, ул. Новаторов 36"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Shield className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Роль
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          >
            <option value="user">Пользователь</option>
            <option value="manager">Менеджер</option>
            <option value="admin">Администратор</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isVerified}
              onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
          </label>
          <span className="text-sm text-foreground">Email подтверждён</span>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Отмена
          </button>
        </div>
      </form>

      {/* Действия */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Действия</h3>
        <div className="flex flex-wrap gap-3">
          {user.blockedAt ? (
            <button
              onClick={handleBlockToggle}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-500 rounded-lg text-sm font-medium hover:bg-green-500/30 transition"
            >
              <CheckCircle className="w-4 h-4" />
              Разблокировать
            </button>
          ) : (
            <button
              onClick={handleBlockToggle}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/30 transition"
            >
              <Ban className="w-4 h-4" />
              Заблокировать
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition"
          >
            <X className="w-4 h-4" />
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}