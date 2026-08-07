'use client';

import { useState } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { Loader2 } from 'lucide-react';

interface OAuthButtonsProps {
  mode?: 'login' | 'register';
}

export function OAuthButtons({ mode = 'login' }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = (provider: 'yandex' | 'max') => {
    setLoading(provider);
    setError(null);
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    const url = `${backendUrl}/api/auth/${provider}`;
    
    console.log(`🔄 OAuth редирект на: ${url}`);
    window.location.href = url;
  };

  return (
    <div className="space-y-3">
      {/* Разделитель */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-muted-foreground/60 font-light">
            {mode === 'login' ? 'Или войдите через' : 'Или зарегистрируйтесь через'}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 text-center bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {/* Яндекс */}
        <button
          onClick={() => handleOAuth('yandex')}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-muted border border-border rounded-lg hover:bg-muted/80 hover:border-foreground/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'yandex' ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <Image
              src="/images/auth/yandex.jpg"
              alt="Яндекс"
              width={20}
              height={20}
              className="w-5 h-5 rounded-sm"
            />
          )}
          <span className="text-sm font-medium text-foreground">
            {loading === 'yandex' ? 'Загрузка...' : 'Яндекс'}
          </span>
        </button>
      </div>
    </div>
  );
}