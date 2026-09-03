'use client';

import { useState } from 'react';
import { Image, Link, useRouter, useSearchParams } from '@/lib/next-shims';
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { OAuthButtons } from '@/components/OAuthButtons';
import { fetchWithCsrf }  from '@/lib/csrf';
import { getPasswordPolicyErrors } from '@/lib/password-policy';
import { readApiError, userMessageFromError } from '@/lib/api-error';
import { getSafeInternalRedirect } from '@/lib/safe-navigation';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState(''); // ✅ ДОБАВЛЕНО
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeInternalRedirect(searchParams.get('redirect'));

  const passwordErrors = getPasswordPolicyErrors(password);
  const isPasswordValid = passwordErrors.length === 0 && password.length > 0;
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Пароль не соответствует требованиям');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const response = await fetchWithCsrf('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName, middleName }), // ✅ ДОБАВЛЕНО middleName
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Не удалось зарегистрироваться. Попробуйте позже.'));
      }

      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&returnUrl=${encodeURIComponent(redirectTo)}&sent=1`);
    } catch (err: unknown) {
      setError(err instanceof TypeError
        ? userMessageFromError(err, 'Не удалось зарегистрироваться. Попробуйте позже.')
        : err instanceof Error ? err.message : 'Не удалось зарегистрироваться. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden pt-20">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-muted/20 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <Image 
              src="/images/logo/logo.png" 
              alt="SWAP SERVICE 38" 
              width={220} 
              height={55} 
              className="h-12 w-auto brightness-0 invert mx-auto"
            />
          </Link>
          <p className="text-muted-foreground text-sm mt-3 font-light">
            Создайте аккаунт
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm text-muted-foreground font-medium mb-2">
                Имя
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm text-muted-foreground font-medium mb-2">
                Фамилия
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Петров"
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
              />
            </div>
            <div>
              <label htmlFor="middleName" className="block text-sm text-muted-foreground font-medium mb-2">
                Отчество
              </label>
              <input
                id="middleName"
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Иванович"
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-muted-foreground font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@mail.ru"
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted-foreground font-medium mb-2">
              Пароль <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition pr-12"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Требования к паролю */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordErrors.map((err) => (
                  <div key={err} className="flex items-center gap-2 text-xs text-red-500">
                    <XCircle className="w-3.5 h-3.5" />
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
            <label htmlFor="confirmPassword" className="block text-sm text-muted-foreground font-medium mb-2">
              Подтвердите пароль <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition pr-12"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
            )}
            {confirmPassword.length > 0 && passwordsMatch && (
              <p className="text-xs text-green-500 mt-1">✓ Пароли совпадают</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid || !passwordsMatch}
            className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <OAuthButtons mode="register" redirectTo={redirectTo} />

        <p className="text-center text-muted-foreground text-sm mt-8 font-light">
          Уже есть аккаунт?{' '}
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-foreground hover:text-muted-foreground transition font-medium">
            Войти
          </Link>
        </p>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition font-light inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
