'use client';

import { useEffect, useState, useCallback } from 'react';

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

  const fetchCart = useCallback(async () => {
    try {
      console.log('🔄 Загрузка корзины...');
      const response = await fetch('/api/cart', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Корзина загружена:', data);
        
        const cartData = data.cart || data;
        setCart(cartData);
        
        const items = cartData?.items || [];
        const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
        setItemsCount(count);
      } else {
        console.error('❌ Ошибка загрузки корзины:', response.status);
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
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId: string, quantity: number = 1) => {
    try {
      console.log(`🛒 Добавление в корзину: ${productId}, кол-во: ${quantity}`);
      
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Товар добавлен в корзину');
        await fetchCart(); // Обновляем корзину
        return true;
      } else {
        console.error('❌ Ошибка API:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Add to cart error:', error);
      return false;
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
        credentials: 'include',
      });
      
      if (response.ok) {
        await fetchCart();
        return true;
      }
    } catch (error) {
      console.error('Update cart error:', error);
    }
    return false;
  };

  const clearCart = async () => {
    try {
      console.log('🧹 Очистка корзины...');
      const response = await fetch('/api/cart/clear', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        console.log('✅ Корзина очищена');
        setCart(null);
        setItemsCount(0);
        return true;
      } else {
        console.error('❌ Ошибка очистки корзины');
        return false;
      }
    } catch (error) {
      console.error('❌ Clear cart error:', error);
      return false;
    }
  };

  return { 
    cart, 
    isLoading, 
    itemsCount,
    addToCart, 
    updateQuantity, 
    clearCart, 
    refetch: fetchCart 
  };
}