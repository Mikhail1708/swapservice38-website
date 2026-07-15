// frontend/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { OAuthButtons } from '@/components/OAuthButtons';
import { fetchWithCsrf } from '@/lib/csrf';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const response = await fetchWithCsrf('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-50 via-white to-gray-50" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-gray-200/30 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-gray-200/20 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <Image 
              src="/images/logo/logo.png" 
              alt="SWAP SERVICE 38" 
              width={220} 
              height={55} 
              className="h-12 w-auto brightness-0 mx-auto"
            />
          </Link>
          <p className="text-gray-400 text-sm mt-3 font-light">Войдите в свой аккаунт</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-600 font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@mail.ru"
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder-gray-400 focus:outline-none focus:border-black/30 transition font-light"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-600 font-medium mb-2">
              Пароль
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder-gray-400 focus:outline-none focus:border-black/30 transition font-light pr-12"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-500 font-light cursor-pointer">
              <input type="checkbox" className="w-4 h-4 border-gray-300 rounded accent-black" />
              Запомнить меня
            </label>
            <Link href="/reset-password" className="text-sm text-gray-400 hover:text-black transition font-light">
              Забыли пароль?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Вход...' : 'Войти'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* OAuth КНОПКИ */}
        <div className="mt-6">
          <OAuthButtons mode="login" />
        </div>

        <p className="text-center text-gray-400 text-sm mt-8 font-light">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-black hover:text-gray-600 transition font-medium">
            Зарегистрироваться
          </Link>
        </p>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-black transition font-light">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}