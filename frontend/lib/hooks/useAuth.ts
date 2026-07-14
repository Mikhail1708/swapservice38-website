// frontend/lib/hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: string;
  isVerified: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const userCache = useRef<User | null>(null);
  const isMounted = useRef(true);
  const fetchPromise = useRef<Promise<void> | null>(null);

  const fetchUser = useCallback(async (force: boolean = false) => {
    // ✅ ЕСЛИ ЕСТЬ КЭШ И НЕ ФОРСИРУЕМ — ВОЗВРАЩАЕМ
    if (userCache.current && !force) {
      if (isMounted.current) {
        setUser(userCache.current);
        setLoading(false);
      }
      return;
    }

    // ✅ ЕСЛИ УЖЕ ЕСТЬ ЗАПРОС В ПРОЦЕССЕ — ЖДЁМ ЕГО
    if (fetchPromise.current) {
      return fetchPromise.current;
    }

    fetchPromise.current = (async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include', // ✅ ВАЖНО! ОТПРАВЛЯЕМ COOKIE
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            userCache.current = data.user;
            if (isMounted.current) {
              setUser(data.user);
            }
          } else {
            userCache.current = null;
            if (isMounted.current) {
              setUser(null);
            }
          }
        } else {
          if (response.status === 401) {
            userCache.current = null;
            if (isMounted.current) {
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('❌ Auth error:', error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
        fetchPromise.current = null;
      }
    })();

    return fetchPromise.current;
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // ✅ ВАЖНО!
      });
      
      userCache.current = null;
      if (isMounted.current) {
        setUser(null);
      }
      
      // ✅ ОЧИЩАЕМ ВСЕ КЭШИ
      localStorage.removeItem('token');
      
      // ✅ РЕДИРЕКТ
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }, []);

  // ✅ ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (ПОСЛЕ СМЕНЫ ПАРОЛЯ)
  const refresh = useCallback(async () => {
    userCache.current = null;
    fetchPromise.current = null;
    await fetchUser(true);
  }, [fetchUser]);

  useEffect(() => {
    isMounted.current = true;
    
    if (fetchedRef.current) {
      return;
    }
    
    fetchedRef.current = true;
    fetchUser();

    return () => {
      isMounted.current = false;
    };
  }, [fetchUser]);

  return { 
    user, 
    loading, 
    logout, 
    refetch: fetchUser,
    refresh,
  };
}