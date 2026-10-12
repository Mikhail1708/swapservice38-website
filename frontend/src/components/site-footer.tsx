
/* frontend/components/site-footer.tsx */

import { useEffect, useState } from 'react';

import {
  loadFooterServices,
  type FooterService,
} from '@/lib/footer-services';

import {
  loadFooterCategories,
  type FooterCategory,
} from '@/lib/footer-categories';

import { Image, Link } from '@/lib/next-shims';
import { SITE_CONTACTS } from '@/lib/site-contacts';

import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  Play,
  MessageCircle,
  MessageSquare,
} from 'lucide-react';

/* ============================================================
   HELPERS
   ============================================================ */

const toSentenceCase = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase('ru-RU');

  return normalized
    ? normalized.charAt(0).toLocaleUpperCase('ru-RU') +
        normalized.slice(1)
    : normalized;
};

type FooterLink = {
  label: string;
  href: string;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const COMPANY_LINKS: FooterLink[] = [
  { label: 'О нас', href: '/#about' },
  { label: 'Наши работы', href: '/swaps' },
  { label: 'Контакты', href: '/contacts' },
];

/* ============================================================
   FOOTER LINK COLUMN
   ============================================================ */

function FooterLinksColumn({
  title,
  links,
}: FooterColumn) {
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
        {title}
      </h4>

      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`} className="min-w-0">
            <Link
              href={link.href}
              className="block max-w-full break-words text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   FOOTER COMPONENT
   ============================================================ */

export function SiteFooter() {
  const [services, setServices] = useState<FooterService[]>([]);
  const [categories, setCategories] = useState<FooterCategory[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    loadFooterServices(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setServices(items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setServices([]);
        }
      });

    loadFooterCategories(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setCategories(items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCategories([]);
        }
      });

    return () => controller.abort();
  }, []);

  const columns: FooterColumn[] = [
    {
      title: 'Компания',
      links: COMPANY_LINKS,
    },
    {
      title: 'Услуги',
      links: [
        {
          label: 'Свапы двигателей',
          href: '/swaps',
        },
        ...services.map((service) => ({
          label: toSentenceCase(service.name),
          href: `/services/${service.id}`,
        })),
      ],
    },
    {
      title: 'Каталог',
      links: [
        {
          label: 'Все товары',
          href: '/catalog',
        },
        ...categories.map((category) => ({
          label: toSentenceCase(category.name),
          href: `/catalog?category=${encodeURIComponent(
            category.name
          )}`,
        })),
      ],
    },
  ];

  return (
    <footer
      id="footer"
      className="w-full min-w-0 max-w-full border-t border-border bg-background pt-14 sm:pt-16"
    >
      {/* ======================================================
          MAIN FOOTER
          ====================================================== */}

      <div className="container-custom grid min-w-0 grid-cols-2 gap-x-6 gap-y-12 pb-14 sm:gap-x-10 lg:grid-cols-6 lg:gap-x-8 lg:gap-y-10">
        {/* ====================================================
            BRAND
            ==================================================== */}

        <div className="col-span-2 min-w-0 lg:col-span-2 lg:pr-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/logo/logo.png"
              alt="SWAPSERVICE38"
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 object-contain brightness-0 invert"
            />

            <span className="heading-display min-w-0 text-base text-foreground">
              SWAPSERVICE38
            </span>
          </div>

          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Свапы двигателей, ремонт и обслуживание автомобилей,
            собственное производство и проектирование
            тюнинг-компонентов. Честный подход и проверенное
            качество для каждого клиента.
          </p>

          {/* SOCIAL LINKS */}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={SITE_CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Send className="h-4 w-4" />
            </a>

            <a
              href={SITE_CONTACTS.max}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MAX"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" />
            </a>

            <a
              href="https://www.instagram.com/swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
            </a>

            <a
              href="https://youtube.com/@swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Play className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* ====================================================
            NAVIGATION COLUMNS
            ==================================================== */}

        {columns.map((column) => (
          <FooterLinksColumn
            key={column.title}
            title={column.title}
            links={column.links}
          />
        ))}

        {/* ====================================================
            CONTACTS

            IMPORTANT:
            On mobile, contacts span both grid columns.
            This prevents the email address and icons
            from expanding the page beyond the viewport.
            ==================================================== */}

        <div className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-1">
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
            Контакты
          </h4>

          <ul className="mt-5 min-w-0 space-y-4 text-sm text-muted-foreground">
            {/* PHONE */}

            <li className="flex min-w-0 items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />

              <a
                href="tel:+79148955888"
                className="min-w-0 transition-colors hover:text-foreground"
              >
                +7 (914) 895-58-88
              </a>
            </li>

            {/* EMAIL */}

            <li className="flex min-w-0 items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />

              <a
                href="mailto:swapservice38@yandex.ru"
                className="min-w-0 max-w-full break-all transition-colors hover:text-foreground"
              >
                swapservice38@yandex.ru
              </a>
            </li>

            {/* ADDRESS */}

            <li className="flex min-w-0 items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

              <span className="min-w-0 break-words">
                г. Иркутск, ул. Новаторов 36
              </span>
            </li>

            {/* WORKING HOURS */}

            <li className="flex min-w-0 items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />

              <span className="min-w-0 break-words">
                Ежедневно с 10:00 до 20:00
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* ======================================================
          BOTTOM BAR — LEGAL LINKS
          ====================================================== */}

      <div className="w-full min-w-0 border-t border-border py-6">
        <div className="container-custom flex min-w-0 flex-col items-start justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
          {/* COPYRIGHT */}

          <span className="min-w-0 max-w-full leading-relaxed">
            © {new Date().getFullYear()} SWAPSERVICE38.
            Все права защищены.
          </span>

          {/* DOCUMENTS */}

          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
            <Link
              href="/privacy"
              className="min-w-0 break-words leading-relaxed transition-colors hover:text-foreground"
            >
              Политика конфиденциальности
            </Link>

            <span
              className="hidden text-muted-foreground/30 sm:inline"
              aria-hidden="true"
            >
              |
            </span>

            <Link
              href="/offer"
              className="min-w-0 break-words leading-relaxed transition-colors hover:text-foreground"
            >
              Договор оферты
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
