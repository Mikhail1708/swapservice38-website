// frontend/components/services.tsx
'use client';

import { useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ArrowRight, Loader2 } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

// ============================================================
// СТАТИЧНАЯ УСЛУГА — СВАПЫ (всегда есть)
// ============================================================
const STATIC_SWAP_SERVICE = {
  id: 'swap-static',
  name: 'Свапы двигателей',
  imageUrl: '/images/engines/3uz.png',
  href: '/swaps',
};

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

// ============================================================
// ЗАГРУЗКА УСЛУГ ИЗ АДМИНКИ
// ============================================================
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
  const services = data.services || [];
  
  return services;
};

// ============================================================
// КОМПОНЕНТ
// ============================================================
export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const data = await fetchServices();
        setServices(data);
      } catch (error) {
        console.error('❌ Ошибка загрузки услуг на главной:', error);
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, []);

  // Все услуги: статичная (свапы) + активные из админки
  const allServices = [
    STATIC_SWAP_SERVICE,
    ...services.filter(s => s.isActive),
  ];

  // Берем первые 4 услуги для отображения на главной
  const displayServices = allServices.slice(0, 4);

  if (loading) {
    return (
      <section id="services" className="border-t border-border bg-background py-24">
        <div className="container-custom">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Услуги
              </span>
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="group relative h-72 flex flex-col justify-end overflow-hidden rounded-md border border-border bg-muted animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <div className="relative flex items-center justify-between gap-2 p-5">
                  <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
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
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Услуги
            </span>
            <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)] text-foreground">
              Что мы делаем
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {displayServices.length} {displayServices.length === 1 ? 'услуга' : 'услуг'}
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Все услуги
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayServices.map((service) => {
            const imageUrl = service.imageUrl || PLACEHOLDER_IMAGE;
            const isStatic = service.id === 'swap-static';
            const href = isStatic ? '/swaps' : `/services/${service.id}`;

            return (
              <Link
                key={service.id}
                href={href}
                className="group relative h-72 flex flex-col justify-end overflow-hidden rounded-md border border-border hover:border-foreground/30 transition"
              >
                <Image
                  src={imageUrl}
                  alt={service.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
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
                  <div className="absolute top-3 left-3">
                    <span className="bg-foreground/80 backdrop-blur-sm text-background text-[10px] font-medium px-2 py-0.5 rounded">
                      Постоянная
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
