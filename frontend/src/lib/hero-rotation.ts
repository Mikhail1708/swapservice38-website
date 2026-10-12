
import generatedAssets from './hero-image-assets.json';

export interface HeroPhoto {
  src: string;
  mobilePosition: string;
  desktopPosition: string;
}

export interface HeroAsset {
  srcSet: string;
  width: number;
  height: number;
}

export const heroAssets = generatedAssets as Record<string, HeroAsset>;

const photo = (
  src: string,
  mobilePosition = '50% 50%',
  desktopPosition = '50% 50%'
): HeroPhoto => ({
  src,
  mobilePosition,
  desktopPosition,
});

export const HERO_PHOTOS: readonly (readonly HeroPhoto[])[] = [
  // 0 — Свап двигателей
  [
    photo('/images/hero-suv4.png', '55% 55%'),
    photo('/images/swap1.png', '50% 55%'),
    photo('/images/swap2.png', '50% 55%', '50% 65%'),
    photo('/images/swap3.png', '50% 55%'),
    photo('/images/swap4.png', '50% 55%'),
  ],

  // 1 — Тюнинг внедорожников
  [
    photo('/images/hero-suv2.png', '60% 65%', '50% 60%'),
    photo('/images/hero/tunning1.png', '50% 50%'),
    photo('/images/tunning2.png', '55% 50%'),
    photo('/images/tunning3.png', '55% 55%'),
    photo('/images/tunning4.png', '50% 55%'),
  ],

  // 2 — Собственное производство
  [
    photo('/images/hero-suv3.png', '50% 65%', '50% 65%'),
    photo('/images/proizvodstvo.png', '50% 55%'),
  ],

  // 3 — Автосервис
  [
    photo('/images/hero-suv1.png', '70% 60%', '50% 60%'),
    photo('/images/service1.png', '65% 60%'),
    photo('/images/service2.png', '50% 55%'),
    photo('/images/service3.png', '60% 50%'),
  ],

  // 4 — Продажа тюнинг-комплектов
  [
    photo('/images/hero-suv5.png', '50% 50%'),
    photo('/images/dorozh1.png', '55% 55%'),
    photo('/images/dorozh2.png', '55% 60%'),
    photo('/images/dorozh3.png', '55% 60%', '50% 60%'),
  ],
];

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Первый понедельник ротации — 12.10.2026.
export const ROTATION_START = Date.UTC(2026, 9, 12);

export function utcWeekIndex(timestamp: number): number {
  return Math.floor((timestamp - ROTATION_START) / WEEK_MS);
}

export function nextUtcWeek(timestamp: number): number {
  const week = utcWeekIndex(timestamp);
  return ROTATION_START + (week + 1) * WEEK_MS;
}

// Простой детерминированный генератор случайных чисел.
function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items: number[], seed: number): number[] {
  const result = [...items];
  const random = randomGenerator(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function seedFor(theme: number, cycle: number): number {
  return (
    Math.imul(theme + 1, 0x9e3779b1) ^
    Math.imul(cycle + 1, 0x85ebca6b) ^
    0x38a12026
  ) >>> 0;
}

// Каждая тематика имеет независимую перестановку.
// В первом цикле оригинальный hero-suv всегда первый.
// Между циклами исключаем немедленный повтор.
export function weeklyPhotoIndex(
  week: number,
  count: number,
  theme = 0
): number {
  if (count <= 1 || week <= 0) return 0;

  const cycle = Math.floor(week / count);
  const position = week % count;

  let indices = [0, ...shuffle(Array.from({ length: count - 1 }, (_, i) => i + 1), seedFor(theme, 0))];
  // Iterative traversal preserves the existing sequence without recursive stack growth.
  for (let cycleNumber = 1; cycleNumber <= cycle; cycleNumber++) {
    const previousLast = indices[count - 1];
    indices = shuffle(
      Array.from({ length: count }, (_, i) => i),
      seedFor(theme, cycleNumber)
    );

    if (indices[0] === previousLast) {
      const swapIndex = indices.findIndex(
        (value, index) => index > 0 && value !== previousLast
      );

      if (swapIndex > 0) {
        [indices[0], indices[swapIndex]] =
          [indices[swapIndex], indices[0]];
      }
    }

  }
  return indices[position];
}

export function selectHeroPhoto(
  theme: number,
  week: number,
  assets: Record<string, HeroAsset> = heroAssets
): HeroPhoto {
  const collection = HERO_PHOTOS[theme];

  if (!collection?.length) {
    throw new Error(`Unknown Hero theme: ${theme}`);
  }

  // Missing assets must not shift every later week's selection.
  const selected = collection[weeklyPhotoIndex(week, collection.length, theme)];
  return assets[selected.src] ? selected : collection[0];
}
