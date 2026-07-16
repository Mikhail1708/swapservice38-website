'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setStatus('error');
      setError(decodeURIComponent(errorParam));
      setTimeout(() => {
        router.push('/login?error=' + encodeURIComponent(errorParam));
      }, 3000);
      return;
    }

    const checkAuth = async () => {
      try {
        // Обновляем CSRF токен
        await fetch('/api/csrf-token', { credentials: 'include' });
        
        // Проверяем авторизацию
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setStatus('success');
            
            // Таймер для редиректа
            const interval = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(interval);
                  router.push('/');
                  router.refresh();
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            
            return;
          }
        }

        setStatus('error');
        setError('Не удалось войти через сервис');
        setTimeout(() => {
          router.push('/login?error=' + encodeURIComponent('Ошибка входа'));
        }, 3000);
      } catch (err) {
        console.error('❌ Ошибка проверки авторизации:', err);
        setStatus('error');
        setError('Ошибка проверки авторизации');
        setTimeout(() => {
          router.push('/login?error=' + encodeURIComponent('Ошибка входа'));
        }, 3000);
      }
    };

    checkAuth();
  }, [router, searchParams]);

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
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Loader2 className="w-16 h-16 animate-spin text-primary" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-background" />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Вход через сервис
              </h1>
              <p className="text-muted-foreground">
                Пожалуйста, подождите...
              </p>
              <div className="mt-6 flex justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-300" />
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Вход выполнен успешно! 🎉
              </h1>
              <p className="text-muted-foreground">
                Перенаправление через {countdown} секунд...
              </p>
              <div className="mt-6 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000"
                  style={{ width: `${(3 - countdown) / 3 * 100}%` }}
                />
              </div>
              <button
                onClick={() => {
                  router.push('/');
                  router.refresh();
                }}
                className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Перейти на главную сейчас
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Ошибка входа
              </h1>
              <p className="text-muted-foreground mb-4">
                {error || 'Произошла ошибка при входе'}
              </p>
              <p className="text-sm text-muted-foreground/70">
                Перенаправление на страницу входа...
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm text-foreground hover:text-muted-foreground transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Перейти к входу
              </Link>
            </>
          )}
        </div>

        {/* Кнопка назад */}
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