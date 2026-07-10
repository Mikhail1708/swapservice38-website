// frontend/lib/hooks/useCart.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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

  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include',
        cache: 'no-store',
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
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (productId: string, quantity: number = 1) => {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const cartData = data.cart || data;
        if (cartData) {
          setCart(cartData);
          const items = cartData.items || [];
          const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
          setItemsCount(count);
        } else {
          await fetchCart();
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Add to cart error:', error);
      return false;
    }
  }, [fetchCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const cartData = data.cart || data;
        if (cartData) {
          setCart(cartData);
          const items = cartData.items || [];
          const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
          setItemsCount(count);
        } else {
          await fetchCart();
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update cart error:', error);
      return false;
    }
  }, [fetchCart]);

  const clearCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart/clear', {
        method: 'DELETE',
        credentials: 'include',
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