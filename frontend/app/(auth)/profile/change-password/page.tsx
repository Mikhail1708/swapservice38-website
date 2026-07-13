// frontend/app/(auth)/profile/change-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Loader2, Save, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ChangePasswordPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // ✅ ОТДЕЛЬНЫЙ СТЕЙТ ДЛЯ КОНТРОЛЯ РЕДИРЕКТА
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // ✅ ПРОВЕРЯЕМ АВТОРИЗАЦИЮ ТОЛЬКО ПОСЛЕ ЗАГРУЗКИ
  useEffect(() => {
    // ✅ ЕСЛИ ЗАГРУЗКА ЗАКОНЧИЛАСЬ И ПОЛЬЗОВАТЕЛЯ НЕТ — РЕДИРЕКТ
    if (!authLoading && !user) {
      setShouldRedirect(true);
      router.push('/login?redirect=/profile/change-password');
    }
  }, [user, authLoading, router]);

  // ✅ ПОКА ЗАГРУЖАЕТСЯ — ПОКАЗЫВАЕМ ЛОАДЕР
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ✅ ЕСЛИ ПОЛЬЗОВАТЕЛЯ НЕТ И РЕДИРЕКТ УЖЕ СДЕЛАН — НЕ РЕНДЕРИМ
  if (!user && !authLoading) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Пароль должен быть минимум 8 символов');
      return;
    }

    if (!formData.currentPassword) {
      setError('Введите текущий пароль');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка смены пароля');
      }

      setSuccess('✅ Пароль успешно изменён!');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      // ✅ ОБНОВЛЯЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
      await refresh();

      // ✅ ЧЕРЕЗ 2 СЕКУНДЫ РЕДИРЕКТ
      setTimeout(() => {
        router.push('/profile');
      }, 2000);

    } catch (error: any) {
      console.error('❌ Ошибка смены пароля:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        <Link 
          href="/profile" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад в профиль
        </Link>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-gray-400" />
            <h1 className="text-2xl font-bold text-black">Смена пароля</h1>
            <span className="text-sm text-gray-400 ml-auto hidden sm:block">
              {user?.email}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1.5">
                Текущий пароль
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                placeholder="Введите текущий пароль"
                required
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1.5">
                Новый пароль
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                placeholder="Минимум 8 символов"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1.5">
                Подтвердите новый пароль
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition"
                placeholder="Повторите новый пароль"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <X className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            <div className="pt-4 flex gap-4 flex-wrap">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}