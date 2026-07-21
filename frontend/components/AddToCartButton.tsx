// frontend/components/AddToCartButton.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Check, Loader2, Plus, Minus, X } from 'lucide-react';
import { useCart } from '@/lib/context/CartContext';

interface AddToCartButtonProps {
  productId: string;
  className?: string;
  showQuantity?: boolean;
  onAdd?: () => void;
}

export function AddToCartButton({ 
  productId, 
  className = '', 
  showQuantity = true,
  onAdd 
}: AddToCartButtonProps) {
  const { addToCart, updateQuantity, refetch, isInCart, getQuantity } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [localCount, setLocalCount] = useState(0);
  
  const inCart = isInCart(productId);
  const cartQuantity = getQuantity(productId);

  // Синхронизируем локальное количество с корзиной
  useEffect(() => {
    if (inCart) {
      setLocalCount(cartQuantity);
      setQuantity(cartQuantity);
    } else {
      setLocalCount(0);
    }
  }, [inCart, cartQuantity]);

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      const result = await addToCart(productId, quantity);
      if (result) {
        await refetch();
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        if (onAdd) onAdd();
      }
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 0) return;
    
    // Если количество становится 0 — удаляем товар из корзины
    if (newQuantity === 0) {
      await updateQuantity(productId, 0);
      await refetch();
      return;
    }
    
    // Обновляем локально сразу
    setLocalCount(newQuantity);
    setQuantity(newQuantity);
    
    // Отправляем на сервер
    try {
      await updateQuantity(productId, newQuantity);
      await refetch();
    } catch (error) {
      console.error('❌ Ошибка обновления количества:', error);
      // Откатываем при ошибке
      setLocalCount(cartQuantity);
      setQuantity(cartQuantity);
    }
  };

  // Если товар в корзине — показываем контролы количества
  if (inCart && localCount > 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/50">
          <button
            onClick={() => handleQuantityChange(localCount - 1)}
            className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
            disabled={isAdding}
          >
            <Minus className="w-3.5 h-3.5 text-foreground" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">
            {localCount}
          </span>
          <button
            onClick={() => handleQuantityChange(localCount + 1)}
            className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
            disabled={isAdding}
          >
            <Plus className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>
        
        {/* Кнопка перейти в корзину */}
        <Link
          href="/cart"
          className="p-2 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted"
          title="Перейти в корзину"
        >
          <ShoppingCart className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Если товара нет в корзине — показываем кнопку "В корзину"
  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {showQuantity && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/50">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
                disabled={quantity <= 1 || isAdding}
              >
                <Minus className="w-3.5 h-3.5 text-foreground" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-foreground">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(prev => prev + 1)}
                className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
                disabled={isAdding}
              >
                <Plus className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={isAdding}
            className={`relative overflow-hidden px-4 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
              inCart
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-foreground hover:bg-foreground/80 text-background'
            } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : inCart ? (
              <>
                <Check className="w-4 h-4" />
                <span>В корзине</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>В корзину</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Тост-уведомление как на WB */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="bg-white/20 rounded-full p-1.5">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Товар добавлен в корзину</p>
              <p className="text-xs text-white/70">Количество: {quantity} шт.</p>
            </div>
            <Link 
              href="/cart" 
              className="ml-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              Перейти
            </Link>
            <button
              onClick={() => setShowToast(false)}
              className="text-white/50 hover:text-white transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}