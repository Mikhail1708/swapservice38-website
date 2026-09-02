// frontend/app/admin/users/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, Image, Link } from '@/lib/next-shims';
import { ArrowLeft, Loader2, Save, X, AlertCircle, CheckCircle, Phone, Mail, User, Shield, MapPin, Home } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';
import { PhoneInput } from '@/components/PhoneInput';
import { AddressInput } from '@/components/AddressInput';
import { validatePhone, normalizePhoneForServer }  from '@/lib/validation/phone';
import { getPasswordPolicyErrors } from '@/lib/password-policy';

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
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

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Неверный формат email';
    }

    const passwordErrors = getPasswordPolicyErrors(form.password);
    if (passwordErrors.length > 0) {
      errors.password = `Пароль: ${passwordErrors.join(', ')}`;
    }

    if (form.phone) {
      const result = validatePhone(form.phone);
      if (!result.valid) {
        errors.phone = result.error;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const phoneForServer = form.phone ? normalizePhoneForServer(form.phone) : '';

      const payload = {
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        phone: phoneForServer || null,
        address: form.address.trim() || null,
        role: form.role,
        isVerified: form.isVerified,
      };

      const response = await fetchWithCsrf('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания пользователя');
      }

      setSuccess('Пользователь успешно создан');
      setTimeout(() => {
        router.push('/admin/users');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания пользователя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Создание пользователя</h1>
          <p className="text-sm text-muted-foreground">Добавьте нового пользователя в систему</p>
        </div>
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
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Mail className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => handleFieldBlur('email')}
            className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition ${
              formErrors.email && touched.email ? 'border-red-500/50 focus:ring-red-500/20' : 'border-border'
            }`}
            placeholder="user@example.com"
          />
          {formErrors.email && touched.email && (
            <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
          )}
        </div>

        {/* Пароль */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Shield className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Пароль <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onBlur={() => handleFieldBlur('password')}
            className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition ${
              formErrors.password && touched.password ? 'border-red-500/50 focus:ring-red-500/20' : 'border-border'
            }`}
            placeholder="Минимум 8 символов, латинские буквы и цифра"
          />
          {formErrors.password && touched.password && (
            <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Имя */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <User className="w-4 h-4 inline mr-1 text-muted-foreground" />
              Имя
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              onBlur={() => handleFieldBlur('firstName')}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              placeholder="Иван"
            />
          </div>

          {/* Фамилия */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <User className="w-4 h-4 inline mr-1 text-muted-foreground" />
              Фамилия
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              onBlur={() => handleFieldBlur('lastName')}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
              placeholder="Петров"
            />
          </div>
        </div>

        {/* Телефон */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Phone className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Телефон
          </label>
          <PhoneInput
            value={form.phone}
            onChange={(val) => setForm({ ...form, phone: val })}
            onBlur={() => {
              handleFieldBlur('phone');
              if (form.phone) {
                const result = validatePhone(form.phone);
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

        {/* Адрес — ИСПОЛЬЗУЕМ AddressInput */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <MapPin className="w-4 h-4 inline mr-1 text-muted-foreground" />
            Адрес
          </label>
          <AddressInput
            value={form.address}
            onChange={(val) => setForm({ ...form, address: val })}
            onBlur={() => handleFieldBlur('address')}
            error={formErrors.address}
            touched={touched.address}
            placeholder="г. Иркутск, ул. Новаторов 36"
          />
        </div>

        {/* Роль */}
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

        {/* Подтверждён */}
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

        {/* Кнопки */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Создание...' : 'Создать'}
            {!loading && <Save className="w-4 h-4" />}
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
    </div>
  );
}
