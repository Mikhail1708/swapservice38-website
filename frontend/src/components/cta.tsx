// frontend/components/cta.tsx
import { Image, Link } from '@/lib/next-shims';
import { ArrowRight } from 'lucide-react';

export function Cta() {
  return (
    <section className="bg-surface pb-24 pt-4 text-surface-foreground">
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src="/images/cta-bg.png"
            alt="Внедорожник на бездорожье"
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
          <div className="relative flex flex-col gap-8 p-8 sm:p-14 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="heading-display text-[clamp(28px,4vw,48px)] text-foreground">
                Готовы к новым приключениям?
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Запишитесь на обслуживание или подберите запчасти в каталоге.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="/contacts"
                className="inline-flex items-center rounded-sm bg-primary px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Записаться на ремонт
              </a>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-sm border border-border px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
              >
                Перейти в каталог
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}