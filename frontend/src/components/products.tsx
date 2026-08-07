// frontend/components/products.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Loader2 } from 'lucide-react';
import { useCart }  from '@/lib/context/CartContext';
import { fetchWithCsrf }  from '@/lib/csrf';

interface Product {
  id: string | number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  inStock: boolean;
  stock?: number;
  images: string[];
  sku: string;
  characteristics?: Record<string, string | string[]>;
  views?: number;
  ordersCount?: number;
  popularity?: number;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

const GUARANTEES = [
  { icon: Truck, title: 'Быстрая доставка', text: 'по всей России' },
  { icon: ShieldCheck, title: 'Гарантия качества', text: 'на всю продукцию' },
  { icon: RotateCcw, title: 'Возврат в течение 14 дней', text: 'без лишних вопросов' },
  { icon: MessageCircle, title: 'Консультация', text: 'по подбору деталей' },
];

// Импортируем иконки (они уже есть в твоём проекте)
import { Truck, ShieldCheck, RotateCcw, MessageCircle } from 'lucide-react';

export function Products() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { addToCart, refetch: refetchCart, isInCart, getQuantity } = useCart();
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка популярных товаров из CRM
  useEffect(() => {
    const fetchPopularProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Загружаем товары из CRM
        const response = await fetchWithCsrf('/api/products?limit=20&sort=popular', {
          method: 'GET',
        });
        
        if (!response.ok) {
          throw new Error('Ошибка загрузки товаров');
        }
        
        const data = await response.json();
        const items = data.items || data || [];
        
        // Сортируем по популярности (если есть поле popularity)
        const sorted = [...items]
          .sort((a, b) => {
            // Если есть popularity — сортируем по нему
            if (a.popularity !== undefined && b.popularity !== undefined) {
              return b.popularity - a.popularity;
            }
            // Если есть ordersCount — по нему
            if (a.ordersCount !== undefined && b.ordersCount !== undefined) {
              return b.ordersCount - a.ordersCount;
            }
            // Если есть views — по нему
            if (a.views !== undefined && b.views !== undefined) {
              return b.views - a.views;
            }
            return 0;
          })
          .slice(0, 5); // Берём топ-5
        
        setProducts(sorted);
      } catch (err) {
        console.error('❌ Ошибка загрузки популярных товаров:', err);
        setError('Не удалось загрузить товары');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularProducts();
  }, []);

  const scrollBy = (dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const handleAddToCart = async (productId: string | number) => {
    const id = String(productId);
    setAddingIds((prev) => new Set(prev).add(id));
    try {
      const result = await addToCart(id, 1);
      if (result) {
        await refetchCart();
      }
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Если загрузка — показываем скелетон
  if (loading) {
    return (
      <section id="products" className="bg-surface py-24 text-surface-foreground">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-surface-muted">
                Популярные товары
              </span>
              <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)]">
                Хиты продаж
              </h2>
            </div>
            <Link
              href="/catalog"
              className="inline-flex items-center rounded-sm bg-surface-foreground px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-surface transition-opacity hover:opacity-90"
            >
              Весь каталог
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-md border border-surface-border bg-surface-card">
                <div className="h-52 bg-surface-muted/20 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-surface-muted/20 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-surface-muted/20 rounded animate-pulse w-1/2" />
                  <div className="h-6 bg-surface-muted/20 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Если товаров нет — показываем заглушку
  if (products.length === 0) {
    return (
      <section id="products" className="bg-surface py-24 text-surface-foreground">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-surface-muted">
                Популярные товары
              </span>
              <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)]">
                Хиты продаж
              </h2>
            </div>
            <Link
              href="/catalog"
              className="inline-flex items-center rounded-sm bg-surface-foreground px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-surface transition-opacity hover:opacity-90"
            >
              Весь каталог
            </Link>
          </div>

          <div className="text-center py-12 text-surface-muted">
            <p>Нет популярных товаров</p>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="bg-surface py-24 text-surface-foreground">
      <div className="container-custom">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-surface-muted">
              Популярные товары
            </span>
            <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)]">
              Хиты продаж
            </h2>
            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center rounded-sm bg-surface-foreground px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-surface transition-opacity hover:opacity-90"
          >
            Весь каталог
          </Link>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Назад"
            className="absolute -left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-card text-surface-foreground shadow-lg lg:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Вперёд"
            className="absolute -right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-card text-surface-foreground shadow-lg lg:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {products.map((p) => {
              const productId = String(p.id);
              const inCart = isInCart(productId);
              const quantity = getQuantity(productId);
              const isAdding = addingIds.has(productId);
              const imageUrl = p.images?.[0] || PLACEHOLDER_IMAGE;

              return (
                <article
                  key={productId}
                  className="flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-md border border-surface-border bg-surface-card"
                >
                  <Link href={`/catalog/${productId}`} className="relative h-52 bg-white">
                    <Image 
                      src={imageUrl} 
                      alt={p.name} 
                      fill 
                      className="object-contain p-6" 
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = PLACEHOLDER_IMAGE;
                      }}
                    />
                    {!p.inStock && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-medium px-2 py-1 rounded-full">
                        Нет в наличии
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 border-t border-surface-border p-5">
                    <Link href={`/catalog/${productId}`}>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.04em] leading-snug hover:text-muted-foreground transition line-clamp-2">
                        {p.name}
                      </h3>
                    </Link>
                    <span className="text-xs uppercase tracking-[0.08em] text-surface-muted line-clamp-1">
                      {p.category || p.description?.slice(0, 30) || ''}
                    </span>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="heading-display text-2xl">
                        {p.price.toLocaleString()} ₽
                      </span>
                      <button
                        onClick={() => handleAddToCart(productId)}
                        disabled={isAdding || !p.inStock}
                        className={`p-2 rounded-lg transition ${
                          !p.inStock
                            ? 'bg-surface-muted/20 text-surface-muted/50 cursor-not-allowed'
                            : inCart
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-surface-foreground text-surface hover:opacity-90'
                        } disabled:opacity-50`}
                      >
                        {isAdding ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : inCart ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {inCart && (
                      <span className="text-xs text-green-600 mt-1">В корзине ({quantity} шт.)</span>
                    )}
                    {!p.inStock && (
                      <span className="text-xs text-red-500 mt-1">Нет в наличии</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 border-t border-surface-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="flex items-center gap-4">
              <g.icon className="h-6 w-6 shrink-0 text-surface-foreground" strokeWidth={1.5} />
              <div>
                <h4 className="text-sm font-semibold">{g.title}</h4>
                <p className="text-xs text-surface-muted">{g.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}