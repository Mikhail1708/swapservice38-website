'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { clearCsrfToken, fetchWithCsrf, getCsrfToken } from '../csrf';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  address?: string;
  role: string;
  isVerified: boolean;
}

interface AuthSnapshot { user: AuthUser | null; loading: boolean }

let snapshot: AuthSnapshot = { user: null, loading: true };
let fetchPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = (next: AuthSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const loadUser = async (force = false): Promise<void> => {
  if (fetchPromise) {
    await fetchPromise;
    if (force) return loadUser(true);
    return;
  }
  if (!force && !snapshot.loading) return;

  emit({ ...snapshot, loading: true });
  fetchPromise = (async () => {
    try {
      await getCsrfToken();
      const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        emit({ user: data.user || null, loading: false });
      } else {
        emit({ user: null, loading: false });
      }
    } catch (error) {
      console.error('Auth request failed:', error);
      emit({ user: null, loading: false });
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
};

export function useAuth() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

  useEffect(() => { void loadUser(); }, []);

  const logout = useCallback(async () => {
    const response = await fetchWithCsrf('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Не удалось завершить сессию');
    }
    clearCsrfToken();
    localStorage.removeItem('token');
    emit({ user: null, loading: false });
  }, []);

  const refresh = useCallback(async () => loadUser(true), []);

  return {
    user: state.user,
    loading: state.loading,
    isLoading: state.loading,
    logout,
    refetch: loadUser,
    refresh,
  };
}
