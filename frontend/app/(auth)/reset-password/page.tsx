// frontend/app/(auth)/reset-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки кода');
      }

      setSuccess(true);
      // Перенаправляем на страницу ввода кода через 1.5 секунды
      setTimeout(() => {
        router.push(`/reset-password/verify?email=${encodeURIComponent(email)}`);
      }, 1500);
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
          <h1 className="text-2xl font-bold text-black mt-6 mb-2">Восстановление пароля</h1>
          <p className="text-gray-400 text-sm font-light">
            Введите email, на который мы отправим код для восстановления
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-medium text-black">Код отправлен!</h2>
            <p className="text-gray-400 text-sm mt-2">
              Проверьте почту <span className="text-black font-medium">{email}</span>
            </p>
            <p className="text-gray-400 text-xs mt-4">Перенаправление...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Отправка...' : 'Отправить код'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        <p className="text-center text-gray-400 text-sm mt-8 font-light">
          Вспомнили пароль?{' '}
          <Link href="/login" className="text-black hover:text-gray-600 transition font-medium">
            Войти
          </Link>
        </p>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-black transition font-light flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}