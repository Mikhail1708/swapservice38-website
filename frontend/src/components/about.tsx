// frontend/components/about.tsx
import { Image, Link } from '@/lib/next-shims';

const STATS = [
  { value: '10+', label: 'лет опыта' },
  { value: '1500+', label: 'довольных клиентов' },
  { value: '3000+', label: 'установленных деталей' },
];

export function About() {
  return (
    <section id="about" className="border-t border-border bg-background py-24">
      <div className="container-custom grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="max-w-lg">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            О нас
          </span>
          <h2 className="heading-display mt-3 text-[clamp(30px,4vw,52px)] text-foreground">
            Делаем то,<br />во что верим
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              SWAP SERVICE 38 — это команда энтузиастов, которая живёт
              внедорожниками. Мы создаём и устанавливаем надёжные решения для
              бездорожья, проверяя их в самых суровых условиях.
            </p>
            <p>Ваш автомобиль — наша страсть.</p>
          </div>
          <Link
            href="/swaps"
            className="mt-8 inline-flex items-center rounded-sm border border-border px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
          >
            Наши работы
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-md border border-border">
          <div className="relative h-72 sm:h-96">
            <Image
              src="/images/workshop.png"
              alt="Внедорожник на подъёмнике в мастерской"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-card">
            {STATS.map((s) => (
              <div key={s.label} className="px-4 py-6 text-center">
                <div className="heading-display text-2xl text-foreground sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}