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

  const fetchUser = useCallback(async () => {
    // ✅ ЕСЛИ ЕСТЬ КЭШ — ВОЗВРАЩАЕМ
    if (userCache.current) {
      setUser(userCache.current);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        userCache.current = data.user;
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        userCache.current = null;
        setUser(null);
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchUser();
  }, [fetchUser]);

  return { user, loading, logout, refetch: fetchUser };
}