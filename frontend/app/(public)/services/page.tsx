// frontend/app/(public)/services/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChevronRight, 
  ArrowRight, 
  Wrench, 
  Shield, 
  ArrowUp, 
  Package, 
  Car, 
  Gauge,
  Sparkles,
  Truck,
  Cog,
  Flame,
  Clock,
  Users
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Услуги — SWAP SERVICE 38',
  description: 'Профессиональные услуги по тюнингу и обслуживанию внедорожников: свапы двигателей, боди-лифт, усиление кузова, установка защиты и многое другое.',
  openGraph: {
    title: 'Услуги — SWAP SERVICE 38',
    description: 'Профессиональные услуги по тюнингу и обслуживанию внедорожников',
    url: 'https://swapservice38.ru/services',
    siteName: 'SWAP SERVICE 38',
    locale: 'ru_RU',
    type: 'website',
  },
  alternates: {
    canonical: 'https://swapservice38.ru/services',
  },
};

const SERVICES = [
  {
    id: 'swap',
    icon: Flame,
    title: 'Свапы двигателей',
    description: 'Профессиональная замена двигателей на 3UZ, 5VZ, VQ35 и другие моторы. Полная интеграция электроники, адаптация коробок передач, охлаждения и топливной системы.',
    price: 'от 150 000 ₽',
    features: ['Полная интеграция электроники', 'Собственные свап-киты', 'Гарантия на работу'],
    image: '/images/engines/3uz.png',
    href: '/swaps',
  },
  {
    id: 'bodylift',
    icon: ArrowUp,
    title: 'Боди-лифт',
    description: 'Поднятие кузова для установки больших колёс и улучшения геометрии автомобиля. Комплекты собственного производства для Nissan Patrol и Toyota Land Cruiser.',
    price: 'от 15 000 ₽',
    features: ['Собственные полиуретановые проставки', 'Увеличение клиренса до 50 мм', 'Установка больших колёс'],
    image: '/images/engines/5vz.jpg',
    href: '/services#bodylift',
  },
  {
    id: 'frame',
    icon: Shield,
    title: 'Усиление кузова',
    description: 'Усиление лонжеронов, порогов и силовых элементов кузова. Повышаем жёсткость и надёжность автомобиля для эксплуатации в тяжёлых условиях.',
    price: 'от 25 000 ₽',
    features: ['Усиление лонжеронов', 'Усиление порогов', 'Повышение жёсткости кузова'],
    image: '/images/engines/vq35.jpg',
    href: '/services#reinforcement',
  },
  {
    id: 'protection',
    icon: Shield,
    title: 'Установка защиты',
    description: 'Защита картера, раздатки, мостов и порогов. Собственные разработки из высокопрочной стали толщиной 5-8 мм.',
    price: 'от 8 000 ₽',
    features: ['Защита картера', 'Защита раздатки', 'Защита мостов и порогов'],
    image: '/images/service-protection.png',
    href: '/services#protection',
  },
  {
    id: 'racks',
    icon: Package,
    title: 'Багажники и фаркопы',
    description: 'Установка крышных и навесных багажников, фаркопов. Поможем подобрать оптимальное решение для перевозки грузов.',
    price: 'от 10 000 ₽',
    features: ['Крышные багажники', 'Навесные багажники', 'Фаркопы и сцепные устройства'],
    image: '/images/service-rack.png',
    href: '/services#racks',
  },
  {
    id: 'diagnostics',
    icon: Gauge,
    title: 'Диагностика',
    description: 'Компьютерная диагностика двигателя и электроники. Выявляем проблемы на ранних стадиях, подбираем оптимальные решения.',
    price: 'от 2 000 ₽',
    features: ['Компьютерная диагностика', 'Проверка электроники', 'Подбор решений'],
    image: '/images/service-diagnostics.png',
    href: '/services#diagnostics',
  },
  {
    id: 'repair',
    icon: Wrench,
    title: 'Ремонт внедорожников',
    description: 'Ремонт ходовой части, трансмиссии и подвески. Используем только качественные запчасти и проверенные технологии.',
    price: 'от 5 000 ₽',
    features: ['Ремонт ходовой', 'Ремонт трансмиссии', 'Ремонт подвески'],
    image: '/images/service-repair.png',
    href: '/services#repair',
  },
  {
    id: 'tuning',
    icon: Sparkles,
    title: 'Тюнинг внедорожников',
    description: 'Комплексный тюнинг внедорожников: установка силовых бамперов, лебёдок, дополнительного освещения и других аксессуаров.',
    price: 'от 20 000 ₽',
    features: ['Силовые бамперы', 'Лебёдки', 'Дополнительное освещение'],
    image: '/images/service-tuning.png',
    href: '/services#tuning',
  },
];

const WHY_CHOOSE_US = [
  {
    icon: Users,
    title: 'Опыт 10+ лет',
    description: 'Более 10 лет в сфере тюнинга и обслуживания внедорожников',
  },
  {
    icon: Cog,
    title: 'Собственное производство',
    description: 'Сами разрабатываем и производим тюнинг-компоненты',
  },
  {
    icon: Clock,
    title: 'Быстрые сроки',
    description: 'Чёткое планирование и выполнение работ в оговоренные сроки',
  },
  {
    icon: Shield,
    title: 'Гарантия',
    description: 'Гарантия на все виды работ и установленные запчасти',
  },
];

export default function ServicesPage() {
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
              по тюнингу и обслуживанию
            </span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Полный спектр услуг по тюнингу, свапам двигателей и обслуживанию внедорожников.
            Работаем с автомобилями любых марок и годов выпуска.
          </p>
        </div>

        {/* Почему выбирают нас */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-lg p-5 text-center hover:border-foreground/30 transition">
              <item.icon className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Список услуг */}
        <div className="space-y-8">
          {SERVICES.map((service, index) => (
            <div 
              key={service.id}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/30 transition ${
                index % 2 === 1 ? 'lg:grid-cols-2' : ''
              }`}
            >
              {/* Изображение */}
              <div className={`relative h-64 lg:h-auto min-h-[300px] bg-muted ${
                index % 2 === 1 ? 'lg:order-2' : ''
              }`}>
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:bg-gradient-to-l lg:from-background lg:via-transparent" />
              </div>

              {/* Контент */}
              <div className={`p-8 flex flex-col justify-center ${
                index % 2 === 1 ? 'lg:order-1' : ''
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <service.icon className="w-8 h-8 text-foreground" />
                  <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Услуга {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="heading-display text-2xl text-foreground">
                  {service.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  {service.description}
                </p>
                
                {/* Особенности */}
                <ul className="mt-4 space-y-2">
                  {service.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <span className="heading-display text-2xl text-foreground">
                    {service.price}
                  </span>
                  <Link
                    href={service.href}
                    className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Подробнее
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA-блок */}
        <div className="mt-16 bg-gradient-to-r from-primary/10 via-muted to-primary/5 border border-border rounded-lg p-8 text-center">
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