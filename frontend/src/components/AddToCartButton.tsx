// frontend/components/AddToCartButton.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ShoppingCart, Check, Loader2, Plus, Minus, X } from 'lucide-react';
import { useCart }  from '@/lib/context/CartContext';

interface AddToCartButtonProps {
  productId: string;
  className?: string;
  showQuantity?: boolean;
  onAdd?: () => void;
  maxStock?: number;
}

export function AddToCartButton({ 
  productId, 
  className = '', 
  showQuantity = true,
  onAdd,
  maxStock: propMaxStock = 999,
}: AddToCartButtonProps) {
  const { addToCart, updateQuantity, isInCart, getQuantity } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [localCount, setLocalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const addInFlightRef = useRef(false);
  
  const inCart = isInCart(productId);
  const cartQuantity = getQuantity(productId);

  // Синхронизируем локальное количество с корзиной
  useEffect(() => {
    if (inCart) {
      setLocalCount(cartQuantity);
      setQuantity(cartQuantity);
    } else {
      setLocalCount(0);
      setQuantity(1);
    }
    setError(null);
  }, [inCart, cartQuantity]);

  const handleAdd = async () => {
    if (addInFlightRef.current) return;
    addInFlightRef.current = true;
    setIsAdding(true);
    setError(null);
    try {
      const result = await addToCart(productId, quantity);
      if (result) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        if (onAdd) onAdd();
      }
    } catch (err: any) {
      if (err.message?.includes('недостаточно') || err.message?.includes('STOCK_LIMIT')) {
        setError(`Доступно только ${propMaxStock} шт.`);
      } else {
        setError('Не удалось обновить корзину. Попробуйте ещё раз.');
      }
    } finally {
      addInFlightRef.current = false;
      setIsAdding(false);
    }
  };

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 0 || isUpdating) return;
    
    // ✅ МИНУС ВСЕГДА РАБОТАЕТ — ПРОВЕРКА ТОЛЬКО ДЛЯ ПЛЮСА
    if (newQuantity > propMaxStock) {
      setError(`Доступно только ${propMaxStock} шт.`);
      return;
    }
    setError(null);

    setLocalCount(newQuantity);
    setQuantity(newQuantity);
    setIsUpdating(true);

    try {
      await updateQuantity(productId, newQuantity);
    } catch (err: any) {
      if (err.message?.includes('недостаточно') || err.message?.includes('STOCK_LIMIT')) {
        setError(`Доступно только ${propMaxStock} шт.`);
      } else {
        setError('Ошибка обновления');
      }
      setLocalCount(cartQuantity);
      setQuantity(cartQuantity);
    } finally {
      setIsUpdating(false);
    }
  };

  // ✅ МИНУС ВСЕГДА АКТИВЕН, ЕСЛИ КОЛИЧЕСТВО > 0
  const canAddMore = localCount < propMaxStock;
  const isOutOfStock = propMaxStock <= 0;

  // Если товар в корзине — контролы количества
  if (inCart && localCount > 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/50">
            <button
              onClick={() => handleQuantityChange(localCount - 1)}
              className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
              disabled={isAdding || isUpdating || localCount <= 0}
              aria-label={localCount === 1 ? 'Удалить товар из корзины' : 'Уменьшить количество'}
            >
              <Minus className="w-3.5 h-3.5 text-foreground" />
            </button>
            <span className="w-8 text-center text-sm font-medium text-foreground">
              {localCount}
            </span>
            <button
              onClick={() => handleQuantityChange(localCount + 1)}
              className={`px-2.5 py-2 transition ${canAddMore ? 'hover:bg-muted' : 'opacity-30 cursor-not-allowed'}`}
              disabled={isAdding || isUpdating || !canAddMore || isOutOfStock}
              aria-label="Увеличить количество"
            >
              <Plus className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
          <Link
            href="/cart"
            className="p-2 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted"
          >
            <ShoppingCart className="w-4 h-4" />
          </Link>
        </div>
        {error && <p role="alert" className="text-xs text-red-500 max-w-56 text-right">{error}</p>}
      </div>
    );
  }

  // Если товара нет в корзине
  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {showQuantity && !isOutOfStock && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/50">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-2 hover:bg-muted transition disabled:opacity-50"
                disabled={quantity <= 1 || isAdding}
                aria-label="Уменьшить количество"
              >
                <Minus className="w-3.5 h-3.5 text-foreground" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-foreground">
                {quantity}
              </span>
              <button
                onClick={() => {
                  if (quantity + 1 > propMaxStock) {
                    setError(`Доступно только ${propMaxStock} шт.`);
                    return;
                  }
                  setError(null);
                  setQuantity(prev => prev + 1);
                }}
                className={`px-2.5 py-2 hover:bg-muted transition ${quantity >= propMaxStock ? 'opacity-30 cursor-not-allowed' : ''}`}
                disabled={isAdding || quantity >= propMaxStock || isOutOfStock}
                aria-label="Увеличить количество"
              >
                <Plus className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={isAdding || isOutOfStock}
            className={`relative overflow-hidden px-4 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
              inCart
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : isOutOfStock
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
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
            ) : isOutOfStock ? (
              <>
                <X className="w-4 h-4" />
                <span>Нет в наличии</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>В корзину</span>
              </>
            )}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-500 max-w-56 text-right">{error}</p>}
      </div>

      {/* Тост */}
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
              aria-label="Закрыть уведомление"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
