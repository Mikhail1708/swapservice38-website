// frontend/app/(auth)/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, Mail, Phone, MapPin, 
  Loader2, Save, X, AlertCircle,
  Package, LogOut, Lock
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ProfilePage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка обновления профиля');
      }

      setSuccess('Профиль успешно обновлён');
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Ошибка обновления профиля:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading) {
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
            <p className="text-gray-400 mt-2">Войдите в аккаунт, чтобы просмотреть профиль</p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <Link 
                href="/login?redirect=/profile" 
                className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
              >
                Войти
              </Link>
              <Link 
                href="/register" 
                className="px-8 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition"
              >
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-gray-400" />
            <h1 className="text-2xl font-bold text-black">Профиль</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-gray-200">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-black">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-1.5">
                  Имя
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                  placeholder="Имя"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-1.5">
                  Фамилия
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                  placeholder="Фамилия"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1.5">
                <Phone className="w-4 h-4 inline mr-1 text-gray-400" />
                Телефон
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                placeholder="+7 (999) 999-99-99"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1.5">
                <MapPin className="w-4 h-4 inline mr-1 text-gray-400" />
                Адрес
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                placeholder="г. Иркутск, ул. Новаторов 36"
              />
            </div>

            <div className="pt-4 flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Сохранить
              </button>
              {success && (
                <span className="text-sm text-green-600">{success}</span>
              )}
              {error && (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {error}
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <Link
            href="/profile/orders"
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-400 transition"
          >
            <Package className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-black">Мои заказы</span>
          </Link>
          <Link
            href="/profile/change-password"
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-400 transition"
          >
            <Lock className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-black">Сменить пароль</span>
          </Link>
        </div>
      </div>
    </div>
  );
}