// frontend/components/site-footer.tsx
import { useEffect, useState } from 'react';
import { loadFooterServices, type FooterService } from '@/lib/footer-services';
import { Image, Link } from '@/lib/next-shims';
import { SITE_CONTACTS } from '@/lib/site-contacts';
import { Phone, Mail, MapPin, Clock, Send, Play, MessageCircle, MessageSquare } from 'lucide-react';

const toSentenceCase = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase('ru-RU');
  return normalized
    ? normalized.charAt(0).toLocaleUpperCase('ru-RU') + normalized.slice(1)
    : normalized;
};

const COLUMNS = [
  {
    title: 'Компания',
    links: [
      { label: 'О нас', href: '/#about' },
      { label: 'Наши работы', href: '/swaps' },
      { label: 'Контакты', href: '/contacts' },
    ],
  },
  {
    title: 'Каталог',
    links: [
      { label: 'Все товары', href: '/catalog' },
      { label: 'Компоненты для свапа', href: '/catalog?category=Компоненты для свапа' },
      { label: 'Внешний обвес', href: '/catalog?category=Внешний обвес' },
      { label: 'Защита', href: '/catalog?category=Защита' },
      { label: 'Багажники', href: '/catalog?category=Багажники' },
    ],
  },
];

export function SiteFooter() {
  const [services, setServices] = useState<FooterService[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    loadFooterServices(controller.signal).then((items) => {
      if (!controller.signal.aborted) setServices(items);
    });
    return () => controller.abort();
  }, []);

  return (
    <footer id="footer" className="border-t border-border bg-background pt-16">
      <div className="container-custom grid grid-cols-2 gap-10 pb-14 lg:grid-cols-5">
        <div className="col-span-2 max-w-xs">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo/logo.png"
              alt="SWAP SERVICE 38"
              width={40}
              height={40}
              className="h-9 w-9 object-contain brightness-0 invert"
            />
            <span className="heading-display text-base text-foreground">
              SWAP SERVICE 38
            </span>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Свапы двигателей, ремонт и обслуживание автомобилей, 
            собственное производство и проектирование тюнинг-компонентов. 
            Честный подход и проверенное качество для каждого клиента.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href={SITE_CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="Telegram"
            >
              <Send className="h-4 w-4" />
            </a>
            <a
              href={SITE_CONTACTS.max}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="MAX"
            >
              <MessageSquare className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="Instagram"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href="https://youtube.com/@swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="YouTube"
            >
              <Play className="h-4 w-4" />
            </a>
          </div>
        </div>

        {[COLUMNS[0], { title: 'Услуги', links: services.map(service => ({ label: toSentenceCase(service.name), href: `/services/${service.id}` })) }, COLUMNS[1]].map((col) => (
          <div key={col.title} className="min-w-0">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground">{col.title}</h4>
            <ul className="mt-5 min-h-[168px] space-y-3">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground break-words transition-colors hover:text-foreground">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
            Контакты
          </h4>
          <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />
              <a href="tel:+79148993838" className="hover:text-foreground">
                +7 (914) 895-58-88
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <a href="mailto:swapservice38@yandex.ru" className="hover:text-foreground">
                swapservice38@yandex.ru
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>г. Иркутск, ул. Новаторов 36</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ежедневно с 10:00 до 20:00</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Нижняя часть с документами */}
      <div className="border-t border-border py-6">
        <div className="container-custom flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} SWAP SERVICE 38. Все права защищены.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition">
              Политика конфиденциальности
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link href="/offer" className="hover:text-foreground transition">
              Договор оферты
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
