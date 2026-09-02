'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from '@/lib/next-shims';
import { Image, Link } from '@/lib/next-shims';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  ArrowRight,
  Mail,
  AlertCircle
} from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';
import { readApiError, userMessageFromError } from '@/lib/api-error';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Таймер для редиректа после успеха
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/login?verified=true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  // Таймер для повторной отправки
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetchWithCsrf('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Неверный или просроченный код.'));
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof TypeError
        ? userMessageFromError(err, 'Не удалось подтвердить email. Попробуйте позже.')
        : err instanceof Error ? err.message : 'Не удалось подтвердить email. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      const response = await fetchWithCsrf('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Не удалось отправить письмо. Попробуйте позже.'));
      }

      setResendSuccess(true);
      setCountdown(60);
    } catch (err: unknown) {
      setError(err instanceof TypeError
        ? userMessageFromError(err, 'Не удалось отправить письмо. Попробуйте позже.')
        : err instanceof Error ? err.message : 'Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden pt-20">
      {/* Фоновые эффекты */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-muted/20 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Логотип */}
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
            Подтверждение email
          </p>
        </div>

        {success ? (
          // Успешное подтверждение
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Email подтверждён! ✅
            </h1>
            <p className="text-muted-foreground">
              Спасибо за регистрацию! Теперь вы можете войти в аккаунт.
            </p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              Перенаправление на страницу входа...
            </p>
            <div className="mt-6 w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
            </div>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm text-foreground hover:text-muted-foreground transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Перейти к входу
            </Link>
          </div>
        ) : (
          // Форма подтверждения
          <>
            {/* Информация о письме */}
            <div className="bg-card border border-border rounded-lg p-4 mb-6 flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground">
                  Код отправлен на <strong>{email || 'ваш email'}</strong>
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Проверьте почту и введите 6-значный код подтверждения
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {resendSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Код отправлен повторно!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-sm text-muted-foreground font-medium mb-2">
                  Код подтверждения
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-5 py-3.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition text-center text-2xl font-bold tracking-[0.5em]"
                  required
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground/50 mt-2 text-center">
                  Введите 6-значный код из письма
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Подтвердить email
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Повторная отправка */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Не пришло письмо?{' '}
                <button
                  onClick={handleResend}
                  disabled={resendLoading || countdown > 0}
                  className="text-foreground hover:text-muted-foreground transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <Loader2 className="w-4 h-4 inline animate-spin" />
                  ) : countdown > 0 ? (
                    `Отправить повторно (${countdown})`
                  ) : (
                    'Отправить повторно'
                  )}
                </button>
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Проверьте папку «Спам», если письмо не пришло
              </p>
            </div>

            {/* Ссылка назад */}
            <div className="text-center mt-6">
              <Link href="/register" className="text-sm text-muted-foreground hover:text-foreground transition font-light inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Вернуться к регистрации
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
