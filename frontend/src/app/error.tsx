// frontend/app/error.tsx (глобальный)
'use client';

import { useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('❌ Глобальная ошибка:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background pt-32">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Что-то пошло не так</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Произошла ошибка. Мы уже работаем над её исправлением.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}