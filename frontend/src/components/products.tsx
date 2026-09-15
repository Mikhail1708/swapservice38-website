// frontend/src/components/products.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Loader2, Star } from 'lucide-react';
import { useCart } from '@/lib/context/CartContext';
import { fetchWithCsrf } from '@/lib/csrf';
import { productAvailability } from '@/lib/product-availability';
import { ProductEnquiry } from '@/components/ProductEnquiry';

interface Product {
  id: string | number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  inStock: boolean;
  stock?: number;
  availableStock?: number;
  images: string[];
  sku: string;
  characteristics?: Record<string, string | string[]>;
  rating?: number;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

const GUARANTEES = [
  { icon: Truck, title: 'Быстрая доставка', text: 'по всей России' },
  { icon: ShieldCheck, title: 'Гарантия качества', text: 'на всю продукцию' },
  { icon: RotateCcw, title: 'Возврат в течение 14 дней', text: 'без лишних вопросов' },
  { icon: MessageCircle, title: 'Консультация', text: 'по подбору деталей' },
];

import { Truck, ShieldCheck, RotateCcw, MessageCircle } from 'lucide-react';

// ============================================================
// КАРТОЧКА ТОВАРА
// ============================================================
function ProductCard({ 
  product, 
  onAddToCart, 
  isAdding, 
  inCart, 
  quantity 
}: { 
  product: Product; 
  onAddToCart: (id: string) => void; 
  isAdding: boolean; 
  inCart: boolean; 
  quantity: number;
}) {
  const productId = String(product.id);
  const [imgError, setImgError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const imageUrl = product.images?.[0] || PLACEHOLDER_IMAGE;
  const finalImageUrl = imgError ? PLACEHOLDER_IMAGE : imageUrl;
  const availability = productAvailability(product);
  const isOutOfStock = availability.isOnOrder;

  return (
    <article className="group flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1">
      {/* Фото */}
      <Link 
        href={`/catalog/${productId}`} 
        className="relative block aspect-square bg-gray-50 overflow-hidden"
      >
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        )}
        
        <Image
          src={finalImageUrl}
          alt={product.name}
          fill
          className={`object-contain p-4 transition-all duration-500 ${
            imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } group-hover:scale-105`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImgError(true);
            setImageLoaded(true);
          }}
          unoptimized
          sizes="(max-width: 768px) 50vw, 260px"
        />

        {/* Бейджи */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {isOutOfStock && (
            <span className="bg-black text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
              Под заказ
            </span>
          )}
          {product.oldPrice && (
            <span className="bg-green-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
              -{Math.round((1 - product.price / product.oldPrice) * 100)}%
            </span>
          )}
        </div>

        {/* Метка "В корзине" */}
        {inCart && !isOutOfStock && (
          <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" />
            {quantity > 1 ? `${quantity} шт.` : 'В корзине'}
          </div>
        )}
      </Link>

      {/* Информация — ВСЁ ЧЁРНОЕ */}
      <div className="flex flex-1 flex-col gap-1 p-4 bg-white">
        {/* Категория */}
        {product.category && (
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            {product.category}
          </span>
        )}

        {/* Название — ЧЁРНОЕ */}
        <Link href={`/catalog/${productId}`}>
          <h3 className="text-sm font-medium text-black leading-snug hover:text-gray-600 transition line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Артикул */}
        {product.sku && (
          <span className="text-[10px] text-gray-400">Арт: {product.sku}</span>
        )}

        {/* Цена — ЧЁРНАЯ */}
        <div className="mt-auto pt-2 flex items-end justify-between">
          <div>
            <span className="text-xl font-bold text-black">
              {product.price.toLocaleString()} ₽
            </span>
            {product.oldPrice && (
              <span className="text-xs text-gray-400 line-through ml-2 block">
                {product.oldPrice.toLocaleString()} ₽
              </span>
            )}
          </div>
          
          {!isOutOfStock && <button
            onClick={() => onAddToCart(productId)}
            disabled={isAdding || isOutOfStock}
            className={`p-2.5 rounded-xl transition-all ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : inCart
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20'
                  : 'bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20'
            } disabled:opacity-50`}
            aria-label={inCart ? 'В корзине' : 'Добавить в корзину'}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : inCart ? (
              <Check className="h-4 w-4" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>}
        </div>

        {/* Остаток */}
        {!isOutOfStock && (
          <span className="text-[10px] text-yellow-600 mt-1">
            {availability.label}
          </span>
        )}
        <ProductEnquiry product={product} />
      </div>
    </article>
  );
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================
export function Products() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { addToCart, refetch: refetchCart, isInCart, getQuantity } = useCart();
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Загрузка популярных товаров
  useEffect(() => {
    const fetchPopularProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchWithCsrf('/api/products?limit=5', {
          method: 'GET',
        });
        
        if (!response.ok) {
          throw new Error('Ошибка загрузки товаров');
        }
        
        const data = await response.json();
        const items = data.items || data || [];
        
        setProducts(items.slice(0, 5));
      } catch (err) {
        console.error('❌ Ошибка загрузки товаров:', err);
        setError('Не удалось загрузить товары');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularProducts();
  }, []);

  // Проверка скролла
  useEffect(() => {
    const checkScroll = () => {
      const el = trackRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    const el = trackRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      setTimeout(checkScroll, 100);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [products]);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
  };

  const handleAddToCart = async (productId: string) => {
    setAddingIds((prev) => new Set(prev).add(productId));
    try {
      await addToCart(productId, 1);
      await refetchCart();
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Скелетон
  if (loading) {
    return (
      <section className="bg-gray-50 py-24">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-black">
                Новинки
              </h2>
            </div>
            <Link
              href="/catalog"
              className="inline-flex items-center rounded-sm bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90"
            >
              Весь каталог
            </Link>
          </div>

          <div className="flex gap-5 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-[260px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="aspect-square bg-gray-100 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Пустое состояние
  if (products.length === 0) {
    return (
      <section className="bg-gray-50 py-24">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-black">
                 Новинки
              </h2>
            </div>
            <Link
              href="/catalog"
              className="inline-flex items-center rounded-sm bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90"
            >
              Весь каталог
            </Link>
          </div>

          <div className="text-center py-12 text-gray-400">
            <p>Нет популярных товаров</p>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-24">
      <div className="container-custom">
        {/* Заголовок — ЧЁРНЫЙ */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-black">
               Новинки
            </h2>
            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center rounded-sm bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90"
          >
            Весь каталог
          </Link>
        </div>

        {/* Карусель */}
        <div className="relative">
          {/* Кнопки навигации */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Назад"
              className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 hidden lg:flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-black hover:text-white transition-all border border-gray-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Вперёд"
              className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 hidden lg:flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-black hover:text-white transition-all border border-gray-200"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Трекинг */}
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {products.map((product) => {
              const productId = String(product.id);
              const inCart = isInCart(productId);
              const quantity = getQuantity(productId);
              const isAdding = addingIds.has(productId);

              return (
                <ProductCard
                  key={productId}
                  product={product}
                  onAddToCart={handleAddToCart}
                  isAdding={isAdding}
                  inCart={inCart}
                  quantity={quantity}
                />
              );
            })}
          </div>
        </div>

        {/* Гарантии — ЧЁРНЫЙ ТЕКСТ */}
        <div className="mt-14 grid grid-cols-1 gap-8 border-t border-gray-200 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="flex items-center gap-4">
              <g.icon className="h-6 w-6 shrink-0 text-black" strokeWidth={1.5} />
              <div>
                <h4 className="text-sm font-semibold text-black">{g.title}</h4>
                <p className="text-xs text-gray-500">{g.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
