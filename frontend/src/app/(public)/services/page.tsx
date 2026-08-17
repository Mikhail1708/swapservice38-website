// frontend/src/app/(public)/services/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Image, Link } from '@/lib/next-shims';
import { 
  ChevronRight, 
  ArrowRight, 
  Wrench, 
  Shield, 
  ArrowUp, 
  Package, 
  Gauge,
  Sparkles,
  Flame,
  Clock,
  Loader2,
  AlertCircle,
  BadgeDollarSign, 
  HeartHandshake,   
} from 'lucide-react';

// ============================================================
// СТАТИЧНАЯ УСЛУГА — СВАПЫ (всегда есть)
// ============================================================
const STATIC_SWAP_SERVICE = {
  id: 'swap-static',
  name: 'Свапы двигателей',
  description: 'Мы выполняем свап двигателей любого типа — от проверенных рядных моторов до V-образных конфигураций. Все этапы сопровождаются профессиональной адаптацией электроники, трансмиссии, системы охлаждения и топливной линии. Результат — идеальная работа всех систем, без сюрпризов.',
  price: 200000,
  imageUrl: '/images/engines/3uz.png',
  isActive: true,
  icon: Flame,
  features: ['Полная интеграция электроники', 'Собственные инженерные решения для свапа', 'Гарантия на работу'],
  href: '/swaps',
};

// ============================================================
// МАППИНГ ИКОНОК ПО НАЗВАНИЮ УСЛУГИ (для динамических)
// ============================================================
const ICON_MAP: Record<string, any> = {
  'Свапы': Flame,
  'Боди-лифт': ArrowUp,
  'Усиление': Shield,
  'Защита': Shield,
  'Багажники': Package,
  'Диагностика': Gauge,
  'Ремонт': Wrench,
  'Тюнинг': Sparkles,
};

const getIcon = (name: string) => {
  for (const [key, Icon] of Object.entries(ICON_MAP)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return Icon;
    }
  }
  return Wrench;
};

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

// ============================================================
// API — ЗАГРУЗКА ДИНАМИЧЕСКИХ УСЛУГ ИЗ ПУБЛИЧНОГО ЭНДПОИНТА
// ============================================================
const fetchServices = async (): Promise<Service[]> => {
  console.log('🔄 Загрузка услуг из публичного API...');
  
  const timestamp = Date.now();
  
  // ✅ ПУБЛИЧНЫЙ ЭНДПОИНТ — НЕ ТРЕБУЕТ АВТОРИЗАЦИИ!
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
  
  console.log(`✅ Загружено ${services.length} услуг`);
  return services;
};

// ============================================================
// КАРТОЧКА УСЛУГИ
// ============================================================
function ServiceCard({ 
  service, 
  index, 
  isStatic = false,
  icon: CustomIcon,
  features,
  href,
}: { 
  service: Service | typeof STATIC_SWAP_SERVICE;
  index: number;
  isStatic?: boolean;
  icon?: any;
  features?: string[];
  href?: string;
}) {
  const [imgError, setImgError] = useState(false);
  
  const Icon = isStatic 
    ? (CustomIcon || Flame) 
    : getIcon(service.name);
  
  const imageUrl = service.imageUrl || PLACEHOLDER_IMAGE;
  const finalImageUrl = imgError ? PLACEHOLDER_IMAGE : imageUrl;
  
  const priceText = service.price && service.price > 0 
    ? `от ${service.price.toLocaleString()} ₽` 
    : 'Цена по запросу';
  
  const linkHref = isStatic ? (href || '/swaps') : `/services/${service.id}`;
  const displayFeatures = isStatic ? features || [] : [];

  return (
    <div 
      className={`grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border border-border rounded-2xl overflow-hidden hover:border-foreground/30 transition ${
        index % 2 === 1 ? 'lg:grid-cols-2' : ''
      }`}
    >
      {/* Изображение */}
      <div className={`relative h-64 lg:h-auto min-h-[300px] bg-muted ${
        index % 2 === 1 ? 'lg:order-2' : ''
      }`}>
        <Image
          src={finalImageUrl}
          alt={service.name}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:bg-gradient-to-l lg:from-background lg:via-transparent" />
        
        {!isStatic && (
          <div className="absolute top-4 right-4">
            {service.isActive ? (
              <span className="bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-medium px-3 py-1 rounded-full">
                Активна
              </span>
            ) : (
              <span className="bg-muted/90 backdrop-blur-sm text-muted-foreground text-[10px] font-medium px-3 py-1 rounded-full">
                Неактивна
              </span>
            )}
          </div>
        )}
        
        {isStatic && (
          <div className="absolute top-4 right-4">
            <span className="bg-foreground/90 backdrop-blur-sm text-background text-[10px] font-medium px-3 py-1 rounded-full">
              Основная услуга
            </span>
          </div>
        )}
      </div>

      {/* Контент */}
      <div className={`p-8 flex flex-col justify-center ${
        index % 2 === 1 ? 'lg:order-1' : ''
      }`}>
        <div className="flex items-center gap-3 mb-3">
        </div>
        <h2 className="heading-display text-2xl text-foreground">
          {service.name}
        </h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          {service.description || 'Описание услуги...'}
        </p>
        
        {isStatic && displayFeatures.length > 0 && (
          <ul className="mt-4 space-y-2">
            {displayFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="heading-display text-2xl text-foreground">
            {priceText}
          </span>
          <Link
            href={linkHref}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isStatic ? 'Смотреть проекты' : 'Подробнее'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// СТАТИЧНЫЕ БЛОКИ (Почему выбирают нас)
// ============================================================
const WHY_CHOOSE_US = [
  {
    icon: Clock,
    title: 'Индивидуальный подход',
    description: 'Подбираем решения под ваши задачи и бюджет, без шаблонных схем.',
  },
  {
    icon: Shield,
    title: 'Гарантия',
    description: 'Гарантия на все виды работ и установленные запчасти.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Честные цены',
    description: 'Прозрачное ценообразование без скрытых платежей и неожиданных сюрпризов.',
  },
  {
    icon: HeartHandshake,
    title: 'Обратная связь',
    description: 'Всегда на связи: отвечаем на звонки и сообщения 7 дней в неделю, 24 часа в сутки.',
  },
];

// ============================================================
// ОСНОВНАЯ СТРАНИЦА
// ============================================================
export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchServices();
        setServices(data);
        
      } catch (err: any) {
        console.error('❌ Ошибка загрузки услуг:', err);
        setError(err.message || 'Ошибка загрузки услуг');
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, []);

  // ✅ ВСЕГДА ПОКАЗЫВАЕМ СВАПЫ + ДИНАМИЧЕСКИЕ УСЛУГИ
  const allServices = [
    STATIC_SWAP_SERVICE,
    ...services.filter(s => s.isActive),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка услуг...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Услуги</span>
        </div>

        {/* Заголовок */}
        <div className="mb-16">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Наши услуги
          </span>
          <h1 className="heading-display mt-3 text-[clamp(32px,4vw,52px)] text-foreground">
            Профессиональные услуги
            <br />
            <span className="text-[clamp(28px,3vw,40px)] text-muted-foreground">
              по свапу двигателей, тюнингу и обслуживанию
            </span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Полный спектр услуг по тюнингу, свапу двигателей и обслуживанию внедорожников.
            Работаем с автомобилями любых марок и годов выпуска.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Всего услуг: {allServices.length}
          </p>
        </div>

        {/* Блоки "Почему выбирают нас" */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-lg p-5 text-center hover:border-foreground/30 transition">
              <item.icon className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl mb-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg text-sm hover:bg-foreground/90 transition"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Список услуг */}
        <div className="space-y-8">
          {allServices.map((service, index) => {
            const isStatic = service.id === 'swap-static';
            
            return (
              <ServiceCard
                key={service.id}
                service={service}
                index={index + 1}
                isStatic={isStatic}
                icon={isStatic ? Flame : undefined}
                features={isStatic ? STATIC_SWAP_SERVICE.features : undefined}
                href={isStatic ? '/swaps' : undefined}
              />
            );
          })}
        </div>

        {/* CTA-блок */}
        <div className="mt-16 bg-gradient-to-r from-primary/10 via-muted to-primary/5 border border-border rounded-2xl p-8 text-center">
          <h2 className="heading-display text-2xl text-foreground">
            Нужна консультация?
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Расскажем, что можно сделать с вашим автомобилем и подберём оптимальное решение.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link
              href="#footer"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Записаться на консультацию
            </Link>
            <Link
              href="/contacts"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
            >
              Контакты
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}