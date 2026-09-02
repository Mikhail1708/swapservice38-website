'use client';

import { useState, useEffect } from 'react';
import { useRouter, Image, Link } from '@/lib/next-shims';
import { PhoneInput } from '@/components/PhoneInput';
import { AddressInput } from '@/components/AddressInput';
import { validatePhone } from '@/lib/validation/phone';
import { fetchWithCsrf } from '@/lib/csrf';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Save,
  X,
  AlertCircle,
  Package,
  LogOut,
  Lock,
  ChevronRight,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { readApiError, userMessageFromError } from '@/lib/api-error';

export default function ProfilePage() {
  const { user, isLoading: authLoading, logout, refresh } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ✅ ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ — ВКЛЮЧАЯ ОТЧЕСТВО
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetchWithCsrf('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          middleName: formData.middleName.trim(), // ✅ ОТЧЕСТВО УХОДИТ В ЗАПРОС
          phone: formData.phone,
          address: formData.address.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Не удалось сохранить изменения.'));
      }

      setSuccess('Профиль успешно обновлён');
      await refresh();
    } catch (error: any) {
      setError(error instanceof TypeError
        ? userMessageFromError(error, 'Не удалось сохранить изменения.')
        : error.message || 'Не удалось сохранить изменения.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось выйти');
    }
  };

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

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-2xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Требуется авторизация</h2>
            <p className="text-muted-foreground mt-2">Войдите в аккаунт, чтобы просмотреть профиль</p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <Link href="/login?redirect=/profile" className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                Войти
              </Link>
              <Link href="/register" className="px-8 py-3 border border-border text-foreground rounded-lg hover:bg-muted transition">
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Профиль</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка — информация о пользователе */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-32">
              <div className="flex items-center gap-4 pb-6 mb-6 border-b border-border">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-bold text-foreground border border-border">
                  {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {user.firstName} {user.lastName} {user.middleName}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.isVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-500 mt-1">
                      <CheckCircle className="w-3 h-3" />
                      Подтверждён
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 bg-muted rounded-lg text-sm font-medium text-foreground"
                >
                  <User className="w-4 h-4" />
                  Профиль
                </Link>
                <Link
                  href="/profile/orders"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <Package className="w-4 h-4" />
                  Мои заказы
                </Link>
                <Link
                  href="/profile/change-password"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <Lock className="w-4 h-4" />
                  Сменить пароль
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
              </div>
            </div>
          </div>

          {/* Правая колонка — форма профиля */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Личные данные</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      onBlur={() => handleFieldBlur('firstName')}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
                      placeholder="Имя"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      Фамилия
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      onBlur={() => handleFieldBlur('lastName')}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
                      placeholder="Фамилия"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      Отчество
                    </label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      onBlur={() => handleFieldBlur('middleName')}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
                      placeholder="Иванович"
                    />
                  </div>
                </div>

                {/* Телефон — PhoneInput */}
                <div>
                  <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                    <Phone className="w-4 h-4 inline mr-1 text-muted-foreground" />
                    Телефон
                  </label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                    onBlur={() => {
                      handleFieldBlur('phone');
                      if (formData.phone) {
                        const result = validatePhone(formData.phone);
                        if (!result.valid) {
                          setFormErrors(prev => ({ ...prev, phone: result.error }));
                        } else {
                          setFormErrors(prev => ({ ...prev, phone: '' }));
                        }
                      }
                    }}
                    error={formErrors.phone}
                    className="w-full"
                  />
                </div>

                {/* Адрес — AddressInput */}
                <div>
                  <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                    <MapPin className="w-4 h-4 inline mr-1 text-muted-foreground" />
                    Адрес
                  </label>
                  <AddressInput
                    value={formData.address}
                    onChange={(val) => setFormData({ ...formData, address: val })}
                    onBlur={() => handleFieldBlur('address')}
                    error={formErrors.address}
                    touched={touched.address}
                    placeholder="г. Иркутск, ул. Новаторов 36"
                  />
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

                <div className="pt-4 border-t border-border flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
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
      </div>
    </div>
  );
}
