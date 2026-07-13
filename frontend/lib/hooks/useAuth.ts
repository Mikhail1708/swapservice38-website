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

  const fetchUser = useCallback(async (force: boolean = false) => {
    // ✅ ЕСЛИ ЕСТЬ КЭШ И НЕ ФОРСИРУЕМ — ВОЗВРАЩАЕМ
    if (userCache.current && !force) {
      if (isMounted.current) {
        setUser(userCache.current);
        setLoading(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'include',
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
        // ✅ ЕСЛИ 401 — ОЧИЩАЕМ КЭШ
        if (response.status === 401) {
          userCache.current = null;
          if (isMounted.current) {
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      // ✅ ПРИ ОШИБКЕ НЕ ОЧИЩАЕМ КЭШ
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
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
    // ✅ ОЧИЩАЕМ КЭШ ПЕРЕД ЗАПРОСОМ
    userCache.current = null;
    await fetchUser(true);
  }, [fetchUser]);

  useEffect(() => {
    isMounted.current = true;
    
    if (fetchedRef.current) {
      // ✅ ЕСЛИ УЖЕ БЫЛ ЗАПРОС, НО ПОЛЬЗОВАТЕЛЬ НУЛЕВОЙ — ПЕРЕЗАПРАШИВАЕМ
      if (!userCache.current && !user) {
        fetchUser(true);
      }
      return;
    }
    
    fetchedRef.current = true;
    fetchUser();

    return () => {
      isMounted.current = false;
    };
  }, []);

  return { 
    user, 
    loading, 
    logout, 
    refetch: fetchUser,
    refresh, // ✅ НОВЫЙ МЕТОД ДЛЯ ОБНОВЛЕНИЯ
  };
}