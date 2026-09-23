// frontend/components/services.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

const STATIC_SWAP_SERVICE = {
  id: 'swap-static',
  name: 'Свапы двигателей',
  imageUrl: '/images/engines/3uz.png',
  href: '/swaps',
};

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

const fetchServices = async (): Promise<Service[]> => {
  const timestamp = Date.now();
  const response = await fetch(`/api/services?_t=${timestamp}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('❌ Ошибка загрузки услуг:', response.status);
    return [];
  }

  const data = await response.json();
  return data.services || [];
};

const serviceWord = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'услуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'услуги';
  return 'услуг';
};

export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadServices = async () => {
      try {
        const data = await fetchServices();
        if (!cancelled) setServices(data);
      } catch (error) {
        console.error('❌ Ошибка загрузки услуг на главной:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadServices();

    return () => {
      cancelled = true;
    };
  }, []);

  const allServices = [
    STATIC_SWAP_SERVICE,
    ...services.filter((service) => service.isActive),
  ];

  const scrollServices = (direction: -1 | 1) => {
    const slider = sliderRef.current;
    if (!slider) return;

    slider.scrollBy({
      left: direction * slider.clientWidth * 0.9,
      behavior: 'smooth',
    });
  };

  if (loading) {
    return (
      <section id="services" className="border-t border-border bg-background py-24">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-foreground">
                Что мы делаем
              </h2>
            </div>

            <Link
              href="/services"
              className="inline-flex items-center rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Все услуги
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-md border border-border bg-muted animate-pulse"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <div className="relative flex items-center justify-between gap-2 p-5">
                  <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="border-t border-border bg-background py-24">
      <div className="container-custom">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-foreground">
              Что мы делаем
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {allServices.length} {serviceWord(allServices.length)}
            </p>
          </div>

          <Link
            href="/services"
            className="inline-flex items-center rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Все услуги
          </Link>
        </div>

        <div className="relative">
          <div
            ref={sliderRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {allServices.map((service) => {
              const imageUrl = service.imageUrl || PLACEHOLDER_IMAGE;
              const isStatic = service.id === 'swap-static';
              const href = isStatic ? '/swaps' : `/services/${service.id}`;

              return (
                <Link
                  key={service.id}
                  href={href}
                  className="group relative flex h-72 min-w-full snap-start flex-col justify-end overflow-hidden rounded-md border border-border transition hover:border-foreground/30 sm:min-w-[calc(50%-0.5rem)] lg:min-w-[calc(25%-0.75rem)]"
                >
                  <Image
                    src={imageUrl}
                    alt={service.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                  <div className="relative flex items-center justify-between gap-2 p-5">
                    <h3 className="heading-display text-base leading-tight text-foreground">
                      {service.name}
                    </h3>
                    <ArrowRight className="h-5 w-5 shrink-0 text-foreground transition-transform group-hover:translate-x-1" />
                  </div>

                  {isStatic && (
                    <div className="absolute left-3 top-3">
                      <span className="rounded bg-foreground/80 px-2 py-0.5 text-[10px] font-medium text-background backdrop-blur-sm">
                        Постоянная
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {allServices.length > 4 && (
            <>
              <button
                type="button"
                onClick={() => scrollServices(-1)}
                aria-label="Предыдущие услуги"
                className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90 lg:inline-flex"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => scrollServices(1)}
                aria-label="Следующие услуги"
                className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90 lg:inline-flex"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
