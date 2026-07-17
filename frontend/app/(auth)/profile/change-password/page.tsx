'use client';

import { fetchWithCsrf } from '@/lib/csrf';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Lock, 
  Loader2, 
  Save, 
  X, 
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ChangePasswordPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setShouldRedirect(true);
      router.push('/login?redirect=/profile/change-password');
    }
  }, [user, authLoading, router]);

  const validatePassword = (pass: string) => {
    const errors = [];
    if (pass.length < 8) errors.push('минимум 8 символов');
    if (!/[A-Z]/.test(pass)) errors.push('заглавная буква');
    if (!/[a-z]/.test(pass)) errors.push('строчная буква');
    if (!/[0-9]/.test(pass)) errors.push('цифра');
    return errors;
  };

  const passwordErrors = validatePassword(formData.newPassword);
  const isPasswordValid = passwordErrors.length === 0 && formData.newPassword.length > 0;
  const passwordsMatch = formData.newPassword === formData.confirmPassword && formData.newPassword.length > 0;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isPasswordValid) {
      setError('Пароль не соответствует требованиям');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!formData.currentPassword) {
      setError('Введите текущий пароль');
      return;
    }

    setLoading(true);

    try {
      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const response = await fetchWithCsrf('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка смены пароля');
      }

      setSuccess('✅ Пароль успешно изменён!');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      await refresh();

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
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-2xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/profile" className="hover:text-foreground transition">Профиль</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Смена пароля</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Смена пароля</h1>
            <span className="text-sm text-muted-foreground ml-auto hidden sm:block">
              {user?.email}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                Текущий пароль
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition pr-12"
                  placeholder="Введите текущий пароль"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                Новый пароль
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition pr-12"
                  placeholder="Минимум 8 символов"
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordErrors.map((err) => (
                    <div key={err} className="flex items-center gap-2 text-xs text-red-500">
                      <X className="w-3.5 h-3.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {isPasswordValid && (
                    <div className="flex items-center gap-2 text-xs text-green-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Пароль соответствует требованиям</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                Подтвердите новый пароль
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition pr-12"
                  placeholder="Повторите новый пароль"
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
              )}
              {formData.confirmPassword.length > 0 && passwordsMatch && (
                <p className="text-xs text-green-500 mt-1">✓ Пароли совпадают</p>
              )}
            </div>

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

            <div className="pt-4 border-t border-border flex gap-4 flex-wrap">
              <button
                type="submit"
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-6 py-2.5 border border-border text-foreground rounded-lg hover:bg-muted transition"
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