'use client';

import { useState, useEffect, useCallback } from 'react';

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
  const [fetched, setFetched] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
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
        setUser(null);
        // Очищаем localStorage
        localStorage.removeItem('token');
        // Перезагружаем страницу чтобы сбросить все состояния
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    fetchUser();
  }, [fetched, fetchUser]);

  return { user, loading, logout, refetch: fetchUser };
}