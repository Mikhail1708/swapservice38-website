// frontend/lib/hooks/useCart.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getCsrfToken, fetchWithCsrf } from '../csrf';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
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
  const fetchedRef = useRef(false);
  const fetchPromise = useRef<Promise<void> | null>(null);

  const fetchCart = useCallback(async () => {
    if (fetchPromise.current) {
      return fetchPromise.current;
    }

    fetchPromise.current = (async () => {
      try {
        setIsLoading(true);
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
        }
      } catch (error) {
        console.error('❌ Cart fetch error:', error);
        setCart(null);
        setItemsCount(0);
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
        return false;
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
      console.error('❌ Add to cart error:', error);
      return false;
    }
  }, []);

  // ✅ ОБНОВЛЕНИЕ КОЛИЧЕСТВА
  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      const response = await fetchWithCsrf('/api/cart/update', {
        method: 'PUT',
        body: JSON.stringify({ productId, quantity }),
      });

      if (!response.ok) {
        return false;
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
      console.error('❌ Update cart error:', error);
      return false;
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
      return false;
    } catch (error) {
      console.error('❌ Clear cart error:', error);
      return false;
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

  return {
    cart,
    isLoading,
    itemsCount,
    addToCart,
    updateQuantity,
    clearCart,
    refetch: fetchCart,
    isInCart,
    getQuantity,
  };
}