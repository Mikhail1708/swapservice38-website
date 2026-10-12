
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from '@/lib/next-shims';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  HERO_PHOTOS,
  heroAssets,
  nextUtcWeek,
  selectHeroPhoto,
  utcWeekIndex,
  type HeroPhoto,
} from '@/lib/hero-rotation';

const HERO_IMAGES = [
  {
    title: 'Свап двигателей',
    subtitle:
      'Профессиональный свап двигателей с полной адаптацией. Решение задач любой сложности.',
    alt: 'Свап двигателей',
  },
  {
    title: 'Тюнинг внедорожников',
    subtitle:
      'Тюнинг внедорожников, реставрация и усиление рам, разработка лифт-комплектов, установка защиты и силовых обвесов.',
    alt: 'Тюнинг внедорожников',
  },
  {
    title: 'Собственное производство',
    subtitle:
      'Проектируем тюнинг-компоненты любой сложности: 3D моделирование, сканирование, 3D печать, лазерная резка и токарная обработка.',
    alt: 'Производство тюнинг-компонентов',
  },
  {
    title: 'Автосервис',
    subtitle:
      'Полный цикл обслуживания автомобилей: диагностика, ремонт двигателя, ходовой части, трансмиссии, замена масла, шиномонтаж и подготовка к сезону.',
    alt: 'Профессиональный автосервис',
  },
  {
    title: 'Продажа тюнинг-комплектов',
    subtitle:
      'Широкий ассортимент тюнинг-комплектов и запчастей для внедорожников. Оригинальные детали и собственные разработки в наличии.',
    alt: 'Продажа тюнинг-комплектов',
  },
] as const;

const SLIDE_INTERVAL = 12000;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const update = () => setReduced(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

function HeroBackground({ photo, active, priority, onReady }: {
  photo: HeroPhoto; active: boolean; priority: boolean; onReady: () => void;
}) {
  const [failed, setFailed] = useState(0);
  const fallback = HERO_PHOTOS.find(collection => collection.some(item => item.src === photo.src))![0];
  const effectivePhoto = failed ? fallback : photo;
  const asset = heroAssets[effectivePhoto.src];
  return (
    <div aria-hidden="true" className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${active ? 'opacity-100' : 'opacity-0'}`}>
      {failed < 2 && <img
        src={failed ? fallback.src : asset?.srcSet.split(',')[0].trim().split(' ')[0] || photo.src}
        srcSet={failed ? undefined : asset?.srcSet}
        sizes={`max(100vw, ${Math.ceil(100 * (asset ? asset.width / asset.height : 1.5))}svh)`}
        alt="" loading="eager" fetchPriority={priority ? 'high' : 'low'} decoding="async"
        onLoad={onReady} onError={() => setFailed(value => value + 1)}
        style={{ '--hero-mobile-position': effectivePhoto.mobilePosition, '--hero-desktop-position': effectivePhoto.desktopPosition } as CSSProperties}
        className="hero-responsive-image"
      />}
    </div>
  );
}

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualChange, setManualChange] = useState(0);
  const [week, setWeek] = useState(() =>
    utcWeekIndex(Date.now())
  );

  const reducedMotion = useReducedMotion();

  const selected = selectHeroPhoto(currentIndex, week);
  const next = selectHeroPhoto((currentIndex + 1) % HERO_IMAGES.length, week);
  const [firstSrc] = useState(() => selectHeroPhoto(0, week).src);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [displayed, setDisplayed] = useState<HeroPhoto | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = Date.now();
      setWeek(utcWeekIndex(now));
      timer = setTimeout(refresh, nextUtcWeek(now) - now);
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    if (!loaded[selected.src]) return;
    const timer = setTimeout(() => setDisplayed(selected), reducedMotion ? 0 : 700);
    return () => clearTimeout(timer);
  }, [selected, loaded[selected.src], reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const timer = window.setTimeout(() => {
      setCurrentIndex(index =>
        (index + 1) % HERO_IMAGES.length
      );
    }, SLIDE_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [currentIndex, manualChange, reducedMotion]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setManualChange(value => value + 1);
  };

  const goToNext = () => {
    goToSlide((currentIndex + 1) % HERO_IMAGES.length);
  };

  const goToPrev = () => {
    goToSlide(
      (currentIndex - 1 + HERO_IMAGES.length) %
        HERO_IMAGES.length
    );
  };

  const currentImage = HERO_IMAGES[currentIndex];

  return (
    <section
      id="top"
      className="relative min-h-[100svh] overflow-hidden pt-20"
    >
      <div className="absolute inset-0">
        {[displayed, selected, loaded[selected.src] ? next : null]
          .filter((photo): photo is HeroPhoto => photo !== null)
          .filter((photo, index, photos) => photos.findIndex(item => item.src === photo.src) === index)
          .map(photo => <HeroBackground key={photo.src} photo={photo} priority={photo.src === firstSrc}
            active={photo.src === displayed?.src || (photo.src === selected.src && (!displayed || !!loaded[photo.src]))}
            onReady={() => setLoaded(previous => previous[photo.src] ? previous : { ...previous, [photo.src]: true })}
          />)}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      </div>

      <div className="absolute bottom-32 right-8 z-20 hidden flex-col gap-2 lg:flex" aria-label="Управление слайдами на компьютере">
        {HERO_IMAGES.map((_, index) => <button type="button" key={index} onClick={() => goToSlide(index)} aria-label={`Переключить на слайд ${index + 1}`} aria-pressed={index === currentIndex}
          className={`w-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none ${index === currentIndex ? 'h-12 bg-primary' : 'h-8 bg-white/30 hover:bg-white/50'}`} />)}
      </div>
      <button type="button" onClick={goToPrev} aria-label="Предыдущий слайд" className="absolute left-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/20 text-white/70 backdrop-blur-sm hover:bg-background/40 hover:text-white lg:flex"><ChevronLeft className="h-5 w-5" /></button>
      <button type="button" onClick={goToNext} aria-label="Следующий слайд" className="absolute right-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/20 text-white/70 backdrop-blur-sm hover:bg-background/40 hover:text-white lg:flex"><ChevronRight className="h-5 w-5" /></button>

      <div className="container-custom relative z-10 flex min-h-[calc(100svh-5rem)] flex-col justify-center py-12 md:py-20 lg:!px-20 xl:!px-8">
        <div className="w-full max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
              SWAPSERVICE38
            </span>
          </div>

          <h1
            key={currentIndex}
            className="heading-display mt-5 text-balance [overflow-wrap:anywhere] text-[clamp(36px,7vw,76px)] text-foreground"
          >
            {currentImage.title}
          </h1>

          <p
            key={`subtitle-${currentIndex}`}
            className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground"
          >
            {currentImage.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap gap-3 md:mt-10 md:gap-4">
            <a
              href="/contacts"
              className="inline-flex min-h-12 items-center justify-center rounded-sm bg-primary px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/90 md:px-8 md:py-4 md:text-xs md:tracking-[0.15em]"
            >
              Записаться на ремонт
            </a>

            <Link
              href="/catalog"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-border px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-card md:px-8 md:py-4 md:text-xs md:tracking-[0.15em]"
            >
              Перейти в каталог
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>

          {/* Мобильная навигация */}
          <div
            className="mt-8 flex max-w-md flex-wrap items-center justify-between gap-2 lg:hidden"
            role="group"
            aria-label="Управление слайдами"
          >
            <button
              type="button"
              onClick={goToPrev}
              aria-label="Предыдущий слайд"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex min-w-[220px] flex-1 max-[419px]:order-last max-[419px]:basis-full">
              {HERO_IMAGES.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => goToSlide(index)}
                  aria-label={`Переключить на слайд ${index + 1}`}
                  aria-pressed={index === currentIndex}
                  className="flex h-12 min-w-[44px] flex-1 items-center px-1"
                >
                  <span
                    className={`h-1.5 w-full rounded-full ${
                      index === currentIndex
                        ? 'bg-primary'
                        : 'bg-white/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={goToNext}
              aria-label="Следующий слайд"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex max-w-xs items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:mt-14">
            <span className="text-foreground">{String(currentIndex + 1).padStart(2, '0')}</span>
            <div className="relative h-px min-w-0 flex-1 overflow-hidden bg-border"><div className="h-full bg-primary transition-all motion-reduce:transition-none" style={{ width: `${(currentIndex + 1) / HERO_IMAGES.length * 100}%` }} /></div>
            <span>05</span>
          </div>
        </div>
      </div>
    </section>
  );
}
