// frontend/app/(public)/contacts/page.tsx
import { Image, Link } from '@/lib/next-shims';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  MessageCircle, 
  Play,
  ChevronRight,
  Instagram,
  Youtube,
  ArrowRight,
  MessageSquare,
  ParkingCircle,
  Wrench,
  FileText,
  X
} from 'lucide-react';


export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Контакты</span>
        </div>

        {/* Заголовок */}
        <div className="mb-16">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Свяжитесь с нами
          </span>
          <h1 className="heading-display mt-3 text-[clamp(32px,4vw,52px)] text-foreground">
            Контакты
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Мы всегда на связи. Звоните, пишите, приезжайте — поможем с любым вопросом.
          </p>
        </div>

        {/* Основная сетка */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка — контакты */}
          <div className="lg:col-span-1 space-y-6">
            {/* Телефон */}
            <div className="bg-card border border-border rounded-lg p-6 hover:border-foreground/30 transition group">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Телефон</h3>
                  <a 
                    href="tel:+79148993838" 
                    className="text-lg font-medium text-foreground hover:text-muted-foreground transition block mt-1"
                  >
                    +7 (914) 895-58-88
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">Автосервис</p>
                  <a 
                    href="tel:+79834460888" 
                    className="text-lg font-medium text-foreground hover:text-muted-foreground transition block mt-1"
                  >
                    +7 (983) 446-08-88
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">Александр — магазин тюнинга</p>
                  <a 
                    href="tel:+79834460888" 
                    className="text-lg font-medium text-foreground hover:text-muted-foreground transition block mt-1"
                  >
                    +7 (924) 553-08-88
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">Николай — вопросы по свапу</p>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="bg-card border border-border rounded-lg p-6 hover:border-foreground/30 transition group">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Email</h3>
                  <a 
                    href="mailto:swapservice38@yandex.ru" 
                    className="text-foreground hover:text-muted-foreground transition block mt-1"
                  >
                    swapservice38@yandex.ru
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">Отвечаем в течение 24 часов</p>
                </div>
              </div>
            </div>

            {/* Адрес */}
            <div className="bg-card border border-border rounded-lg p-6 hover:border-foreground/30 transition group">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Адрес</h3>
                  <p className="text-foreground mt-1">г. Иркутск, ул. Новаторов 36</p>
                  <a 
                    href="https://yandex.ru/maps/-/CTFs7UKi" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1 mt-1"
                  >
                    Открыть на карте
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Режим работы */}
            <div className="bg-card border border-border rounded-lg p-6 hover:border-foreground/30 transition group">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Режим работы</h3>
                  <p className="text-foreground mt-1">Ежедневно с 10:00 до 20:00</p>
                  <p className="text-xs text-muted-foreground mt-1">Без выходных</p>
                </div>
              </div>
            </div>

            {/* Соцсети и мессенджеры */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Мы в соцсетях и мессенджерах</h3>
              <div className="flex gap-3 flex-wrap">
                <a
                  href="https://t.me/swap38"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Telegram"
                >
                  <Send className="h-5 w-5" />
                </a>
                <a
                  href="https://web.max.ru/-70953461855659"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground hover:bg-muted"
                  aria-label="MAX"
                >
                  <MessageSquare className="h-5 w-5" />
                </a>
                <a
                  href="https://www.instagram.com/swapservice38"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="https://youtube.com/@swapservice38"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground hover:bg-muted"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Правая колонка — карта */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden h-[600px] relative">
              <iframe
                src="https://yandex.ru/map-widget/v1/?um=constructor%3A8f2f6a0b8a1d4a0a9c9e8f7d6c5b4a3a&amp;source=constructor&amp;pt=104.216053,52.363528&amp;zoom=17"
                width="100%"
                height="100%"
                frameBorder="0"
                className="hover:opacity-95 transition"
                allowFullScreen
                loading="lazy"
                title="Карта SWAP SERVICE 38"
              />
            </div>

            {/* Дополнительная информация — ТЕПЕРЬ В ОДНОМ СТИЛЕ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-card border border-border rounded-lg p-5 text-center hover:border-foreground/30 transition group">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition mb-3">
                  <ParkingCircle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Бесплатная парковка</p>
                <p className="text-xs text-muted-foreground">Для клиентов</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-5 text-center hover:border-foreground/30 transition group">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition mb-3">
                  <Wrench className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Осмотр на месте</p>
                <p className="text-xs text-muted-foreground">Бесплатная диагностика</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-5 text-center hover:border-foreground/30 transition group">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition mb-3">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Консультация</p>
                <p className="text-xs text-muted-foreground">По телефону или в сервисе</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA-блок */}
        <div className="mt-16 bg-gradient-to-r from-primary/10 via-muted to-primary/5 border border-border rounded-lg p-8 text-center">
          <h2 className="heading-display text-2xl text-foreground">
            Не нашли ответ?
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Свяжитесь с нами любым удобным способом — мы поможем!
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <a
              href="tel:+79148993838"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Phone className="w-4 h-4" />
              Позвонить
            </a>
            <a
              href="mailto:swapservice38@yandex.ru"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
            >
              <Mail className="w-4 h-4" />
              Написать
            </a>
            <a
              href="https://web.telegram.org/k/#@swap38"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-card"
            >
              <Send className="w-4 h-4" />
              Написать в Telegram
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}