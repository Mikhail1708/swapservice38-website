// frontend/components/services.tsx
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const SERVICES = [
  { title: 'Свапы двигателей', image: '/images/engines/3uz.png', href: '/swaps' },
  { title: 'Усиление кузова', image: '/images/engines/5vz.jpg', href: '/services' },
  { title: 'Боди-лифт', image: '/images/engines/vq35.jpg', href: '/services' },
  { title: 'Установка защиты', image: '/images/service-protection.png', href: '/services' },
  { title: 'Багажники и фаркопы', image: '/images/service-rack.png', href: '/services' },
];

export function Services() {
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map((s) => (
            <Link
              key={s.title}
              href={s.href}
              className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-md border border-border"
            >
              <Image
                src={s.image}
                alt={s.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <div className="relative flex items-center justify-between gap-2 p-5">
                <h3 className="heading-display text-base leading-tight text-foreground">
                  {s.title}
                </h3>
                <ArrowRight className="h-5 w-5 shrink-0 text-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}