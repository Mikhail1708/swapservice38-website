'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Truck, ShieldCheck, RotateCcw, MessageCircle, ShoppingCart, Check } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

const FEATURED_PRODUCTS = [
  { id: '1', title: 'Комплект для боди-лифта', sub: 'Nissan Patrol Y60/Y61', price: 18900, image: '/images/product-liftkit.png' },
  { id: '2', title: 'Крепление канистры', sub: 'Универсальное', price: 6500, image: '/images/product-canister.png' },
  { id: '3', title: 'Бак в крыло Y60', sub: '90 литров', price: 24900, image: '/images/product-tank.png' },
  { id: '4', title: 'Усилитель рамы', sub: 'Nissan Patrol Y60/Y61', price: 9900, image: '/images/product-frame.png' },
  { id: '5', title: 'Защита раздатки', sub: 'Nissan Patrol Y60/Y61', price: 7900, image: '/images/product-transfer.png' },
];

const GUARANTEES = [
  { icon: Truck, title: 'Быстрая доставка', text: 'по всей России' },
  { icon: ShieldCheck, title: 'Гарантия качества', text: 'на всю продукцию' },
  { icon: RotateCcw, title: 'Возврат в течение 14 дней', text: 'без лишних вопросов' },
  { icon: MessageCircle, title: 'Консультация', text: 'по подбору деталей' },
];

export function Products() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { addToCart, refetch, isInCart, getQuantity } = useCart();
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const scrollBy = (dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const handleAddToCart = async (productId: string) => {
    setAddingIds((prev) => new Set(prev).add(productId));
    try {
      await addToCart(productId, 1);
      await refetch();
    } catch (error) {
      console.error('Ошибка добавления в корзину:', error);
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

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
            {FEATURED_PRODUCTS.map((p) => {
              const inCart = isInCart(p.id);
              const quantity = getQuantity(p.id);
              const isAdding = addingIds.has(p.id);

              return (
                <article
                  key={p.id}
                  className="flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-md border border-surface-border bg-surface-card"
                >
                  <Link href={`/catalog/${p.id}`} className="relative h-52 bg-white">
                    <Image src={p.image} alt={p.title} fill className="object-contain p-6" unoptimized />
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 border-t border-surface-border p-5">
                    <Link href={`/catalog/${p.id}`}>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.04em] leading-snug hover:text-muted-foreground transition">
                        {p.title}
                      </h3>
                    </Link>
                    <span className="text-xs uppercase tracking-[0.08em] text-surface-muted">
                      {p.sub}
                    </span>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="heading-display text-2xl">
                        {p.price.toLocaleString()} ₽
                      </span>
                      <button
                        onClick={() => handleAddToCart(p.id)}
                        disabled={isAdding}
                        className={`p-2 rounded-lg transition ${
                          inCart
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