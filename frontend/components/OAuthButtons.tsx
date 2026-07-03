'use client';

import { useState } from 'react';
import Image from 'next/image';

interface OAuthButtonsProps {
  mode?: 'login' | 'register';
}

export function OAuthButtons({ mode = 'login' }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = (provider: 'yandex' | 'max') => {
    setLoading(provider);
    setError(null);
    
    // Используем полный URL с портом бэкенда
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const url = `${backendUrl}/api/auth/${provider}`;
    
    console.log(`🔄 OAuth редирект на: ${url}`);
    
    // Прямой редирект на бэкенд
    window.location.href = url;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-400 font-light">
            {mode === 'login' ? 'Или войдите через' : 'Или зарегистрируйтесь через'}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 text-center bg-red-50 px-4 py-2 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {/* Яндекс */}
        <button
          onClick={() => handleOAuth('yandex')}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-2xl hover:border-gray-400 transition disabled:opacity-50 hover:shadow-sm"
        >
          <Image
            src="/images/auth/yandex.jpg"
            alt="Яндекс"
            width={20}
            height={20}
            className="w-5 h-5"
          />
          <span className="text-sm font-medium text-gray-700">
            {loading === 'yandex' ? 'Загрузка...' : 'Яндекс'}
          </span>
        </button>
      </div>
    </div>
  );
}