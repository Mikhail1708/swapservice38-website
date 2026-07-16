'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function OAuthSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
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

    return () => clearInterval(interval);
  }, [router]);

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
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center relative">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <div className="absolute -top-1 -right-1">
                <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
                  <span className="text-xs">✅</span>
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Вход выполнен успешно! 
          </h1>
          
          <p className="text-muted-foreground">
            Добро пожаловать в SWAP SERVICE 38
          </p>
          
          <div className="mt-4 text-sm text-muted-foreground/70">
            Перенаправление через {countdown} секунд...
          </div>

          {/* Прогресс-бар */}
          <div className="mt-4 w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${(3 - countdown) / 3 * 100}%` }}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
            >
              Перейти на главную
            </button>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition"
            >
              Перейти в профиль
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition font-light inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}