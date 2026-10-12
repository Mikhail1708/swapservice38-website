from pathlib import Path
p = Path('frontend/src/components/hero.tsx')
s = p.read_text(encoding='utf-8')
start = s.index('function HeroBackground(')
end = s.index('export function Hero()', start)
s = s[:start] + '''function HeroBackground({ photo, active, priority, onReady }: {
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

''' + s[end:]
start = s.index('  useEffect(() => {\n    const updateWeek')
end = s.index('  useEffect(() => {\n    if (reducedMotion)', start)
s = s[:start] + '''  const selected = selectHeroPhoto(currentIndex, week);
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

''' + s[end:]
start = s.index('        {HERO_IMAGES.map((image, index) => (')
end = s.index('\n\n        <div className="pointer-events-none',start)
s = s[:start] + '''        {[displayed, selected, loaded[selected.src] ? next : null]
          .filter((photo): photo is HeroPhoto => photo !== null)
          .filter((photo, index, photos) => photos.findIndex(item => item.src === photo.src) === index)
          .map(photo => <HeroBackground key={photo.src} photo={photo} priority={photo.src === firstSrc}
            active={photo.src === displayed?.src || (photo.src === selected.src && !!loaded[photo.src])}
            onReady={() => setLoaded(previous => previous[photo.src] ? previous : { ...previous, [photo.src]: true })}
          />)}''' + s[end:]
s=s.replace('href="/contacts"','href="#footer"')
s=s.replace('max-w-md items-center gap-2 md:hidden','max-w-md flex-wrap items-center justify-between gap-2 lg:hidden')
s=s.replace('className="flex min-w-0 flex-1"','className="flex min-w-[220px] flex-1 max-[419px]:order-last max-[419px]:basis-full"')
s=s.replace('flex h-12 min-w-0 flex-1 items-center px-1','flex h-12 min-w-[44px] flex-1 items-center px-1')
start=s.index('          {/* Десктопная навигация */}')
end=s.index('\n        </div>\n      </div>\n    </section>',start)
s=s[:start]+'''          <div className="mt-6 flex max-w-xs items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:mt-14">
            <span className="text-foreground">{String(currentIndex + 1).padStart(2, '0')}</span>
            <div className="relative h-px min-w-0 flex-1 overflow-hidden bg-border"><div className="h-full bg-primary transition-all motion-reduce:transition-none" style={{ width: `${(currentIndex + 1) / HERO_IMAGES.length * 100}%` }} /></div>
            <span>05</span>
          </div>''' +s[end:]
marker='      <div className="container-custom relative z-10'
start=s.index(marker)
s=s[:start]+'''      <div className="absolute bottom-32 right-8 z-20 hidden flex-col gap-2 lg:flex" aria-label="Управление слайдами на компьютере">
        {HERO_IMAGES.map((_, index) => <button type="button" key={index} onClick={() => goToSlide(index)} aria-label={`Переключить на слайд ${index + 1}`} aria-pressed={index === currentIndex}
          className={`w-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none ${index === currentIndex ? 'h-12 bg-primary' : 'h-8 bg-white/30 hover:bg-white/50'}`} />)}
      </div>
      <button type="button" onClick={goToPrev} aria-label="Предыдущий слайд" className="absolute left-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/20 text-white/70 backdrop-blur-sm hover:bg-background/40 hover:text-white lg:flex"><ChevronLeft className="h-5 w-5" /></button>
      <button type="button" onClick={goToNext} aria-label="Следующий слайд" className="absolute right-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/20 text-white/70 backdrop-blur-sm hover:bg-background/40 hover:text-white lg:flex"><ChevronRight className="h-5 w-5" /></button>

''' +s[start:]
s=s.replace('py-12 md:py-20','py-12 md:py-20 lg:!px-20 xl:!px-8')
p.write_text(s,encoding='utf-8')
