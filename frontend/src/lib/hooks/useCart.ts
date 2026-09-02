// frontend/lib/hooks/useCart.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getCsrfToken, fetchWithCsrf } from '../csrf';
import { readApiError, userMessageFromError } from '../api-error';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  maxStock?: number; // ✅ ДОБАВЛЯЕМ
}

interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  itemsCount: number;
}

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [itemsCount, setItemsCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const fetchPromise = useRef<Promise<void> | null>(null);

  const fetchCart = useCallback(async () => {
    if (fetchPromise.current) {
      return fetchPromise.current;
    }

    fetchPromise.current = (async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        await getCsrfToken();

        const response = await fetch('/api/cart', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const cartData = data.cart || data;
          setCart(cartData);
          
          const items = cartData?.items || [];
          const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
          setItemsCount(count);
        } else {
          setCart(null);
          setItemsCount(0);
          if (response.status !== 401) {
            setLoadError(await readApiError(response, 'Не удалось загрузить корзину. Попробуйте ещё раз.'));
          }
        }
      } catch (error) {
        setCart(null);
        setItemsCount(0);
        setLoadError(userMessageFromError(error, 'Не удалось загрузить корзину. Попробуйте ещё раз.'));
      } finally {
        setIsLoading(false);
        fetchPromise.current = null;
      }
    })();

    return fetchPromise.current;
  }, []);

  const addToCart = useCallback(async (productId: string, quantity: number = 1) => {
    try {
      const response = await fetchWithCsrf('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });

      if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({}));
        // ✅ ПРОБРАСЫВАЕМ ОШИБКУ С ДЕТАЛЯМИ
        const error = new Error(await readApiError(response, 'Не удалось обновить корзину. Попробуйте ещё раз.'));
        (error as any).availableStock = errorData.availableStock;
        (error as any).currentQuantity = errorData.currentQuantity;
        (error as any).maxAvailable = errorData.maxAvailable;
        (error as any).code = errorData.code;
        throw error;
      }

      const data = await response.json();
      const cartData = data.cart || data;
      
      if (cartData) {
        setCart(cartData);
        const items = cartData.items || [];
        const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
        setItemsCount(count);
      }
      return true;
    } catch (error) {
      if (error instanceof TypeError) throw new Error(userMessageFromError(error, 'Не удалось обновить корзину. Попробуйте ещё раз.'));
      throw error;
    }
  }, []);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      const response = await fetchWithCsrf('/api/cart/update', {
        method: 'PUT',
        body: JSON.stringify({ productId, quantity }),
      });

      if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({}));
        const error = new Error(await readApiError(response, 'Не удалось обновить корзину. Попробуйте ещё раз.'));
        (error as any).availableStock = errorData.availableStock;
        (error as any).code = errorData.code;
        throw error;
      }

      const data = await response.json();
      const cartData = data.cart || data;
      
      if (cartData) {
        setCart(cartData);
        const items = cartData.items || [];
        const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
        setItemsCount(count);
      }
      return true;
    } catch (error) {
      if (error instanceof TypeError) throw new Error(userMessageFromError(error, 'Не удалось обновить корзину. Попробуйте ещё раз.'));
      throw error;
    }
  }, []);

  const clearCart = useCallback(async () => {
    try {
      const response = await fetchWithCsrf('/api/cart/clear', {
        method: 'DELETE',
      });

      if (response.ok) {
        setCart(null);
        setItemsCount(0);
        return true;
      }
      throw new Error(await readApiError(response, 'Не удалось очистить корзину. Попробуйте ещё раз.'));
    } catch (error) {
      if (error instanceof TypeError) throw new Error(userMessageFromError(error, 'Не удалось очистить корзину. Попробуйте ещё раз.'));
      throw error;
    }
  }, []);

  // Первоначальная загрузка
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchCart();
  }, [fetchCart]);

  const isInCart = useCallback((productId: string): boolean => {
    if (!cart) return false;
    return cart.items.some(item => item.productId === productId);
  }, [cart]);

  const getQuantity = useCallback((productId: string): number => {
    if (!cart) return 0;
    const item = cart.items.find(item => item.productId === productId);
    return item?.quantity || 0;
  }, [cart]);

  // ✅ ПОЛУЧАЕМ МАКСИМАЛЬНЫЙ ОСТАТОК ДЛЯ ТОВАРА
  const getMaxStock = useCallback((productId: string): number => {
    if (!cart) return 999;
    const item = cart.items.find(item => item.productId === productId);
    return item?.maxStock || 999;
  }, [cart]);

  return {
    cart,
    isLoading,
    itemsCount,
    loadError,
    addToCart,
    updateQuantity,
    clearCart,
    refetch: fetchCart,
    isInCart,
    getQuantity,
    getMaxStock, // ✅ ДОБАВЛЯЕМ
  };
}
