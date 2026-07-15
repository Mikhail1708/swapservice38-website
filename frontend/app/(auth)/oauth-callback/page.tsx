// frontend/app/(auth)/oauth-callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setStatus('error');
      setError(decodeURIComponent(errorParam));
      setTimeout(() => {
        router.push('/login?error=' + encodeURIComponent(errorParam));
      }, 2000);
      return;
    }

    const checkAuth = async () => {
      try {
        // Принудительно обновляем CSRF токен
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
            // ✅ Перенаправляем на главную через 1.5 секунды
            setTimeout(() => {
              router.push('/');
              router.refresh();
            }, 1500);
            return;
          }
        }

        // Если не авторизован — перенаправляем на логин
        setStatus('error');
        setError('Не удалось войти через Яндекс');
        setTimeout(() => {
          router.push('/login?error=' + encodeURIComponent('Ошибка входа через Яндекс'));
        }, 2000);
      } catch (err) {
        console.error('❌ Ошибка проверки авторизации:', err);
        setStatus('error');
        setError('Ошибка проверки авторизации');
        setTimeout(() => {
          router.push('/login?error=' + encodeURIComponent('Ошибка входа через Яндекс'));
        }, 2000);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-6">
        {status === 'loading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Вход через Яндекс</h1>
            <p className="text-gray-400">Пожалуйста, подождите...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Вход выполнен успешно! 🎉</h1>
            <p className="text-gray-400">Перенаправление на главную...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Ошибка входа</h1>
            <p className="text-gray-400">{error || 'Произошла ошибка при входе'}</p>
            <p className="text-sm text-gray-300 mt-2">Перенаправление на страницу входа...</p>
          </>
        )}
      </div>
    </div>
  );
}