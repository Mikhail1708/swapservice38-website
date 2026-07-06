// frontend/app/(auth)/profile/change-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Loader2, Save, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ChangePasswordPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ✅ РЕДИРЕКТ ТОЛЬКО ПОСЛЕ ЗАГРУЗКИ
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/profile/change-password');
    }
  }, [user, authLoading, router]);

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

      setSuccess('Пароль успешно изменён');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('❌ Ошибка смены пароля:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm">
                {success}
              </div>
            )}

            <div className="pt-4">
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}