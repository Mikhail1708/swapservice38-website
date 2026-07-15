import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden pt-20">
      <Image
        src="/images/hero-suv.png"
        alt="Модифицированный внедорожник в студии"
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />

      <div className="container-custom relative flex min-h-[100svh] flex-col justify-center pt-28 pb-16">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
            SWAP SERVICE 38
          </span>

          <h1 className="heading-display mt-5 text-balance text-[clamp(40px,7vw,76px)] text-foreground">
            Тюнинг и обслуживание внедорожников
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
            Собственное производство тюнинг-компонентов. Тестируем всё на реальных
            авто, прежде чем отдать клиенту.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#footer"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Записаться на ремонт
            </a>
            <a
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
            >
              Перейти в каталог
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-14 flex items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-foreground">01</span>
            <span className="h-px w-24 bg-border" />
            <span>03</span>
          </div>
        </div>
      </div>
    </section>
  );
}