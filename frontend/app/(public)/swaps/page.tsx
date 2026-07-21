// frontend/app/(public)/swaps/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChevronRight, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Eye, 
  Heart,
  Flame,
  Gauge,
  Zap,
  Truck,
  Wrench,
  Loader2
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Свапы двигателей — SWAP SERVICE 38',
  description: 'Профессиональная замена двигателей на внедорожники и коммерческий транспорт. Установка моторов 3UZ, 5VZ, VQ35 и других.',
  openGraph: {
    title: 'Свапы двигателей — SWAP SERVICE 38',
    description: 'Профессиональная замена двигателей на внедорожники и коммерческий транспорт.',
    url: 'https://swapservice38.ru/swaps',
    siteName: 'SWAP SERVICE 38',
    locale: 'ru_RU',
    type: 'website',
  },
  alternates: {
    canonical: 'https://swapservice38.ru/swaps',
  },
};

// Это будет работать как Server Component
// Данные загружаются на сервере
async function getArticles() {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
  
  try {
    const response = await fetch(`${baseUrl}/api/articles?published=true&type=swap`, {
      cache: 'force-cache', // Кэшируем на сервере
      next: { revalidate: 3600 }, // Пересобираем каждый час
    });
    
    if (!response.ok) {
      return { items: [] };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Ошибка загрузки статей:', error);
    return { items: [] };
  }
}

const SWAP_ICONS: Record<string, any> = {
  '3UZ': Flame,
  '5VZ': Gauge,
  'VQ35': Zap,
  'BMW': Truck,
  'V8': Flame,
  'V6': Gauge,
  'Turbo': Zap,
  'Diesel': Truck,
};

export default async function SwapsPage() {
  const data = await getArticles();
  const articles = data.items || [];

  const getIconForArticle = (article: any) => {
    const tags = article.tags || [];
    for (const tag of tags) {
      for (const [key, Icon] of Object.entries(SWAP_ICONS)) {
        if (tag.includes(key)) return Icon;
      }
    }
    return Wrench;
  };

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Свапы двигателей</span>
        </div>

        {/* Заголовок */}
        <div className="mb-12">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Свапы двигателей
          </span>
          <h1 className="heading-display mt-3 text-[clamp(32px,4vw,52px)] text-foreground">
            Свапы двигателей
            <br />
            <span className="text-[clamp(28px,3vw,40px)] text-muted-foreground">
              на внедорожники и коммерческий транспорт
            </span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Устанавливаем мощные и надёжные моторы «под ключ» с полной интеграцией электроники.
            Собственные свап-киты — идеальная посадка без «колхоза».
          </p>
        </div>

        {/* Что такое свап */}
        <div className="bg-gradient-to-r from-card to-card/50 border border-border rounded-lg p-8 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="heading-display text-2xl text-foreground mb-4">
                Что такое свап двигателя?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Свап двигателя — это не просто «переставить мотор». Это комплекс инженерных задач:
                совместимость электроники, переделка креплений, адаптация коробок передач,
                охлаждения, выпуска, топливной системы. Мы решаем эти задачи профессионально,
                потому что делаем это каждый день.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">⚡</div>
                <p className="text-xs font-medium text-foreground">Мощность</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">🔧</div>
                <p className="text-xs font-medium text-foreground">Надёжность</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">💰</div>
                <p className="text-xs font-medium text-foreground">Экономия</p>
              </div>
            </div>
          </div>
        </div>

        {/* Популярные моторы */}
        <div className="mb-12">
          <h2 className="heading-display text-2xl text-foreground mb-6">
            Популярные моторы
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: '3UZ-FE', spec: 'V8 4.3 л', desc: 'Легендарный японский V8' },
              { name: '5VZ-FE', spec: 'V6 3.4 л', desc: '«Вечный» мотор Toyota' },
              { name: 'VQ35DE', spec: 'V6 3.5 л', desc: 'Мощный современный V6' },
              { name: 'BMW M57', spec: '3.0d турбо', desc: 'Турбодизель с тягой' },
            ].map((m) => (
              <div key={m.name} className="bg-card border border-border rounded-lg p-4 text-center hover:border-foreground/30 transition">
                <div className="heading-display text-lg text-foreground">{m.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.spec}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Список проектов */}
        {articles.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <p className="text-muted-foreground">Проектов не найдено</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article: any) => {
              const Icon = getIconForArticle(article);
              return (
                <Link
                  key={article.id}
                  href={`/swaps/${article.slug || article.id}`}
                  className="group bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/30 transition hover:shadow-lg flex flex-col"
                >
                  {/* Изображение */}
                  <div className="relative h-48 bg-muted overflow-hidden">
                    {article.imageUrl ? (
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Icon className="w-12 h-12 opacity-20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    
                    {/* Иконка мотора */}
                    <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-2">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    
                    {/* Теги */}
                    <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                      {(article.tags || []).slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-background/80 backdrop-blur-sm text-foreground px-2 py-0.5 rounded-full border border-border/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Контент */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-muted-foreground transition line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">
                      {article.description}
                    </p>

                    {/* Метрики */}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(article.date).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readTime || 5} мин
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {article.views || 0}
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Heart className="w-3.5 h-3.5" />
                        {article.likesCount || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Статистика */}
        {articles.length > 0 && (
          <div className="mt-8 text-center text-xs text-muted-foreground/70">
            Всего проектов: {articles.length}
          </div>
        )}

        {/* CTA-блок */}
        <div className="mt-16 bg-gradient-to-r from-primary/10 via-muted to-primary/5 border border-border rounded-lg p-8 text-center">
          <h2 className="heading-display text-2xl text-foreground">
            Хотите сделать свап?
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Приезжайте на консультацию. Рассчитаем бюджет, подберём мотор
            и разработаем индивидуальный план работ.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link
              href="#footer"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Записаться на консультацию
            </Link>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
            >
              Посмотреть каталог
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}