// frontend/lib/hooks/useAdminTable.ts
import { useState, useEffect, useCallback } from 'react';
import { getCsrfToken } from '../csrf';

interface UseAdminTableOptions {
  url: string;
  limit?: number;
  initialPage?: number;
  autoFetch?: boolean;
}

interface UseAdminTableResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  refetch: () => Promise<void>;
  setLimit: (limit: number) => void;
}

export function useAdminTable<T>({
  url,
  limit = 20,
  initialPage = 1,
  autoFetch = true,
}: UseAdminTableOptions): UseAdminTableResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLimit, setCurrentLimit] = useState(limit);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getCsrfToken();
      const response = await fetch(
        `${url}?page=${page}&limit=${currentLimit}`,
        {
          credentials: 'include',
          headers: {
            'CSRF-Token': token,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
      }

      const result = await response.json();

      // Автоматически определяем где лежат данные
      const items = result.items || result.data || result.orders || result.users || result.appointments || [];

      setData(items);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || Math.ceil((result.total || 0) / currentLimit) || 1);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [url, page, currentLimit]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const setLimit = useCallback((newLimit: number) => {
    setCurrentLimit(newLimit);
    setPage(1);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [fetchData, autoFetch]);

  return {
    data,
    total,
    page,
    totalPages,
    loading,
    error,
    goToPage,
    refetch,
    setLimit,
  };
}