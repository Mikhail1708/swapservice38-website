// frontend/src/app/oauth-success/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OAuthSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Успешный вход! 🎉</h1>
        <p className="text-muted-foreground mt-2 font-light">
          Вы успешно вошли в свой аккаунт
        </p>
        <p className="text-sm text-muted-foreground/60 mt-4 font-light">
          Перенаправление через {countdown}...
        </p>
      </div>
    </div>
  );
}