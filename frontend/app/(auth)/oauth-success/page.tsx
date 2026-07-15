// frontend/app/(auth)/oauth-success/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter }from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';

export default function OAuthSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Перенаправляем на главную через 1.5 секунды
    const timer = setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-black mb-2">Вход выполнен успешно! 🎉</h1>
        <p className="text-gray-400">Перенаправление...</p>
        <div className="mt-4 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    </div>
  );
}