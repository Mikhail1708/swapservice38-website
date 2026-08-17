'use client';

import { useState, useEffect, useCallback } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const HERO_IMAGES = [
  {
    src: '/images/hero-suv4.png',
    alt: 'Модифицированный внедорожник в студии',
    title: 'Свап двигателей',
    subtitle: 'Профессиональный свап двигателей с полной адаптацией. Решение задач любой сложности.'
  },
  {
    src: '/images/hero-suv2.png',
    alt: 'Внедорожник на бездорожье',
    title: 'Тюнинг внедорожников',
    subtitle: 'Тюнинг внедорожников, реставрация и усиление рам, разработка лифт-комплектов, установка защиты и силовых обвесов.'
  },
  {
    src: '/images/hero-suv3.png',
    alt: 'Мастерская по тюнингу',
    title: 'Собственное производство',
    subtitle: 'Проектируем тюнинг-компоненты любой сложности: 3D моделирование, сканирование, 3D печать, лазерная резка и токарная обработка.'
  },
  {
    src: '/images/hero-suv1.png', // Замените на своё фото сервиса (например, фото мастерской)
    alt: 'Профессиональный сервис',
    title: 'Автосервис',
    subtitle: 'Полный цикл обслуживания автомобилей: диагностика, ремонт двигателя, ходовой части, трансмиссии, замена масла, шиномонтаж и подготовка к сезону.'
  },
  {
    src: '/images/hero-suv5.png', // Замените на своё фото магазина (например, фото стеллажа с деталями)
    alt: 'Продажа тюнинг-комплектов',
    title: 'Продажа тюнинг-комплектов',
    subtitle: 'Широкий ассортимент тюнинг-комплектов и запчастей для внедорожников. Оригинальные детали и собственные разработки в наличии.'
  },
];

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning]);

  const goToNext = useCallback(() => {
    goToSlide((currentIndex + 1) % HERO_IMAGES.length);
  }, [currentIndex, goToSlide]);

  const goToPrev = useCallback(() => {
    goToSlide((currentIndex - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  }, [currentIndex, goToSlide]);

  // Автоматическое переключение каждые 12 секунд (чтобы текст успели прочитать)
  useEffect(() => {
    const timer = setInterval(goToNext, 12000);
    return () => clearInterval(timer);
  }, [goToNext]);

  const currentImage = HERO_IMAGES[currentIndex];

  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden pt-20">
      {/* Карусель изображений */}
      <div className="absolute inset-0">
        {HERO_IMAGES.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              index === currentIndex
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-105'
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0}
              className="object-cover object-center"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      </div>

      {/* Индикаторы в правом нижнем углу */}
      <div className="absolute bottom-32 right-8 z-10 flex flex-col gap-2">
        {HERO_IMAGES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-1.5 h-8 rounded-full transition-all duration-500 ${
              index === currentIndex
                ? 'bg-primary h-12'
                : 'bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Переключить на слайд ${index + 1}`}
          />
        ))}
      </div>

      {/* Кнопки навигации */}
      <button
        onClick={goToPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/20 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-background/40 transition-all duration-300"
        aria-label="Предыдущий слайд"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/20 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-background/40 transition-all duration-300"
        aria-label="Следующий слайд"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Контент */}
      <div className="container-custom relative z-10 flex min-h-[100svh] flex-col justify-center pt-28 pb-16">
        <div className="w-full max-w-3xl">
          {/* Индикатор текущего слайда */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
              SWAP SERVICE 38
            </span>
          </div>

          {/* Заголовок с анимацией */}
          <div className="relative overflow-hidden">
            <h1
              key={currentIndex}
              className="heading-display mt-5 text-balance text-[clamp(40px,7vw,76px)] text-foreground transition-all duration-700 ease-in-out"
            >
              {currentImage.title}
            </h1>
          </div>

          {/* Подзаголовок с анимацией и полным отображением текста */}
          <div className="relative overflow-hidden mt-3">
            <p
              key={`sub-${currentIndex}`}
              className="w-full text-pretty text-base leading-relaxed text-muted-foreground transition-all duration-700 ease-in-out delay-100 whitespace-pre-line"
            >
              {currentImage.subtitle}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#footer"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
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

          {/* Прогресс-бар */}
          <div className="mt-14 flex items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-foreground">01</span>
            <div className="relative h-px w-48 bg-border overflow-hidden">
              <div
                className="absolute inset-0 bg-primary transition-all duration-5000 ease-linear"
                style={{
                  width: `${((currentIndex + 1) / HERO_IMAGES.length) * 100}%`,
                }}
              />
            </div>
            <span>{String(HERO_IMAGES.length).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}