
'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  Image,
  Link,
  usePathname,
  useRouter,
  useSearchParams,
} from '@/lib/next-shims';
import {
  Menu,
  X,
  ShoppingCart,
  User,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LogOut,
  Settings,
  Package,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCart } from '@/lib/context/CartContext';

const CATEGORIES = [
  { label: 'Все товары', href: '/catalog' },
  {
    label: 'Компоненты для свапа',
    href: '/catalog?category=Компоненты для свапа',
  },
  {
    label: 'Компоненты для свапа РАЗНОЕ',
    href: '/catalog?category=Компоненты для свапа РАЗНОЕ',
  },
  {
    label: 'Компоненты для подвески, лифт комплекты',
    href: '/catalog?category=Компоненты для подвески, лифт комплекты',
  },
  {
    label: 'Внешний обвес',
    href: '/catalog?category=Внешний обвес',
  },
  {
    label: 'TLC80',
    href: '/catalog?category=TLC80',
  },
  {
    label: 'Свап-кит SC 3UZ',
    href: '/catalog?category=Свап-кит SC 3UZ',
  },
  {
    label: 'Компоненты для джипов РАЗНОЕ',
    href: '/catalog?category=Компоненты для джипов РАЗНОЕ',
  },
];

const NAV = [
  { label: 'Услуги', href: '/services' },
  { label: 'Каталог', href: '/catalog' },
  { label: 'О нас', href: '/#about' },
  { label: 'Контакты', href: '/contacts' },
];

const PHONE = '+7 (914) 895-58-88';
const PHONE_HREF = 'tel:+79148955888';

export function scrollFromHeader(event: MouseEvent<HTMLElement>) {
  const target = event.target;

  if (!(target instanceof Element)) return;

  if (
    target.closest(
      'a, button, input, select, textarea, summary, nav, [role="button"], [role="menu"], [data-header-menu]'
    )
  ) {
    return;
  }

  const scroller = document.scrollingElement;
  if (!scroller || scroller.scrollTop === 0) return;

  scroller.scrollTo({
    top: 0,
    behavior: window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
      ? 'auto'
      : 'smooth',
  });
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, isLoading, logout } = useAuth();
  const { itemsCount, refetch: refetchCart } = useCart();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] =
    useState(false);
  const [desktopCatalogOpen, setDesktopCatalogOpen] =
    useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);

  const catalogRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const catalogTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const isStaff =
    user?.role === 'admin' || user?.role === 'manager';

  const selectedCategory = searchParams?.get('category') || '';

  const accountName =
    user?.firstName ||
    user?.email?.split('@')[0] ||
    'Мой аккаунт';

  const accountInitial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  function closeMobile() {
    setMobileOpen(false);
    setMobileCatalogOpen(false);
  }

  function closeDesktopCatalog() {
    if (catalogTimeoutRef.current) {
      clearTimeout(catalogTimeoutRef.current);
      catalogTimeoutRef.current = undefined;
    }

    setDesktopCatalogOpen(false);
  }

  function isActive(href: string) {
    if (href === '/#about') return false;

    if (href === '/catalog') {
      return pathname?.startsWith('/catalog');
    }

    if (href === '/services') {
      return (
        pathname?.startsWith('/services') ||
        pathname?.startsWith('/swaps')
      );
    }

    return (
      pathname === href ||
      pathname?.startsWith(`${href}/`)
    );
  }

  function isCategoryActive(label: string) {
    if (pathname !== '/catalog') return false;

    if (label === 'Все товары') {
      return !selectedCategory;
    }

    return selectedCategory === label;
  }

  async function handleLogout() {
    try {
      await logout();
      setAccountOpen(false);
      closeMobile();
      router.replace('/');
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Не удалось выйти из аккаунта'
      );
    }
  }

  useEffect(() => {
    refetchCart();
  }, [pathname, refetchCart]);

  useEffect(() => {
    if (itemsCount <= 0) return;

    setCartBounce(true);

    const timeout = setTimeout(() => {
      setCartBounce(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [itemsCount]);

  useEffect(() => {
    setMobileOpen(false);
    setMobileCatalogOpen(false);
    setDesktopCatalogOpen(false);
    setAccountOpen(false);
  }, [pathname, selectedCategory]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;

    document.body.style.overflow = 'hidden';

    const firstFocusable =
      mobilePanelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])'
      );

    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobile();
        closeDesktopCatalog();
        setAccountOpen(false);
      }

      if (event.key === 'Tab' && mobileOpen) {
        const panel = mobilePanelRef.current;
        const toggle = mobileButtonRef.current;

        if (!panel) return;

        const elements = [
          ...(toggle ? [toggle] : []),
          ...Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])'
            )
          ),
        ].filter(
          (element) => element.getClientRects().length > 0
        );

        if (!elements.length) return;

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (
        catalogRef.current &&
        !catalogRef.current.contains(target)
      ) {
        closeDesktopCatalog();
      }

      if (
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      );
    };
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');

    const handleChange = () => {
      if (media.matches) closeMobile();
    };

    media.addEventListener('change', handleChange);

    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (catalogTimeoutRef.current) {
        clearTimeout(catalogTimeoutRef.current);
      }
    };
  }, []);

  function openDesktopCatalog() {
    if (catalogTimeoutRef.current) {
      clearTimeout(catalogTimeoutRef.current);
      catalogTimeoutRef.current = undefined;
    }

    setDesktopCatalogOpen(true);
  }

  function scheduleDesktopCatalogClose() {
    catalogTimeoutRef.current = setTimeout(() => {
      setDesktopCatalogOpen(false);
    }, 180);
  }

  const mobileNavClass =
    'flex min-h-[56px] w-full items-center justify-between gap-4 py-4 text-left text-[16px] font-medium tracking-[-0.015em] text-foreground transition-colors hover:text-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  const mobileAccountClass =
    'flex min-h-[46px] w-full items-center gap-3 py-3 text-left text-sm text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <>
     <header
  data-site-header
  onClick={scrollFromHeader}
  className="fixed left-0 right-0 top-0 z-50 w-full min-w-0 max-w-full border-b border-border bg-background/85 backdrop-blur-md"
>
        <div className="container-custom flex h-20 items-center justify-between gap-3">
          <Link
            href="/"
            onClick={closeMobile}
            aria-label="SWAPSERVICE38 — главная"
            className="flex min-w-0 shrink-0 items-center gap-3"
          >
            <Image
              src="/images/logo/logo.png"
              alt="SWAPSERVICE38"
              width={44}
              height={44}
              className="h-10 w-10 shrink-0 object-contain brightness-0 invert"
            />

            <span className="heading-display hidden text-lg leading-none tracking-tight text-foreground sm:inline">
              SWAPSERVICE38
            </span>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav
            aria-label="Основная навигация"
            className="hidden items-center gap-8 lg:flex"
          >
            {NAV.map((item) => {
              if (item.label === 'Каталог') {
                return (
                  <div
                    key={item.href}
                    ref={catalogRef}
                    className="relative"
                    onMouseEnter={openDesktopCatalog}
                    onMouseLeave={scheduleDesktopCatalogClose}
                  >
                    <button
                      type="button"
                      aria-expanded={desktopCatalogOpen}
                      aria-controls="desktop-catalog-menu"
                      onClick={() =>
                        setDesktopCatalogOpen(
                          (value) => !value
                        )
                      }
                      className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                        isActive(item.href)
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Каталог
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          desktopCatalogOpen
                            ? 'rotate-180'
                            : ''
                        }`}
                      />
                    </button>

                    {desktopCatalogOpen && (
                      <div
                        id="desktop-catalog-menu"
                        data-header-menu
                        className="absolute left-0 top-full z-50 w-[320px] pt-4"
                      >
                        <div className="rounded-lg border border-border bg-card p-2 shadow-2xl">
                          {CATEGORIES.map((category) => (
                            <Link
                              key={category.href}
                              href={category.href}
                              onClick={closeDesktopCatalog}
                              className={`block rounded-md px-4 py-3 text-sm leading-snug transition-colors ${
                                isCategoryActive(category.label)
                                  ? 'bg-muted text-foreground'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              {category.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* HEADER CONTROLS */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="mr-3 hidden text-right xl:block">
              <a
                href={PHONE_HREF}
                className="block text-sm font-semibold text-foreground"
              >
                {PHONE}
              </a>

              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Ежедневно с 10:00 до 20:00
              </span>
            </div>

            <Link
              href="/cart"
              onClick={closeMobile}
              aria-label={`Корзина, товаров: ${itemsCount}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <ShoppingCart
                className={`h-5 w-5 transition-transform ${
                  cartBounce ? 'scale-110' : 'scale-100'
                }`}
              />

              {itemsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {itemsCount > 99 ? '99+' : itemsCount}
                </span>
              )}
            </Link>

            {/* DESKTOP ACCOUNT */}
            <div
              ref={accountRef}
              className="relative hidden lg:block"
            >
              {isLoading ? (
                <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
              ) : user ? (
                <>
                  <button
                    type="button"
                    aria-label="Личный кабинет"
                    aria-expanded={accountOpen}
                    onClick={() =>
                      setAccountOpen((value) => !value)
                    }
                    className="flex h-11 items-center gap-2 rounded-md px-2 transition-colors hover:bg-card"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {accountInitial}
                    </span>

                    <span className="hidden max-w-24 truncate text-sm text-foreground xl:inline">
                      {accountName}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        accountOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {accountOpen && (
                    <div
                      data-header-menu
                      className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
                    >
                      <div className="border-b border-border px-4 py-4">
                        <p className="truncate text-sm font-medium text-foreground">
                          {accountName}
                        </p>

                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>

                      <div className="p-2">
                        <Link
                          href="/profile"
                          onClick={() =>
                            setAccountOpen(false)
                          }
                          className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <User className="h-4 w-4" />
                          Профиль
                        </Link>

                        <Link
                          href="/profile/orders"
                          onClick={() =>
                            setAccountOpen(false)
                          }
                          className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Package className="h-4 w-4" />
                          Мои заказы
                        </Link>

                        {isStaff && (
                          <Link
                            href="/admin"
                            onClick={() =>
                              setAccountOpen(false)
                            }
                            className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Settings className="h-4 w-4" />
                            Админ-панель
                          </Link>
                        )}

                        <div className="my-2 border-t border-border" />

                        <button
                          type="button"
                          onClick={() =>
                            void handleLogout()
                          }
                          className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
                        >
                          <LogOut className="h-4 w-4" />
                          Выйти
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Войти
                  </Link>

                  <Link
                    href="/register"
                    className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
                  >
                    Регистрация
                  </Link>
                </div>
              )}
            </div>

            {/* MOBILE TOGGLE */}
            <button
              ref={mobileButtonRef}
              type="button"
              aria-label={
                mobileOpen
                  ? 'Закрыть меню'
                  : 'Открыть меню'
              }
              aria-expanded={mobileOpen}
              aria-controls="mobile-site-navigation"
              onClick={() => {
                setMobileOpen((value) => !value);
                setAccountOpen(false);
                closeDesktopCatalog();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-card lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* NEW MINIMAL MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Закрыть мобильное меню"
            onClick={closeMobile}
            tabIndex={-1}
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
          />

          <div
            id="mobile-site-navigation"
            ref={mobilePanelRef}
            data-header-menu
            role="dialog"
            aria-modal="true"
            aria-label="Мобильное меню"
            className="absolute inset-x-0 bottom-0 top-20 flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-t border-border bg-background"
          >
            <div className="container-custom mx-auto flex w-full max-w-xl flex-1 flex-col pb-8 pt-7">
              {/* NAVIGATION */}
              <nav aria-label="Мобильная навигация">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Меню
                </p>

                <Link
                  href="/services"
                  onClick={closeMobile}
                  className={`${mobileNavClass} border-b border-border`}
                >
                  <span>Услуги</span>

                  <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                </Link>

                <button
                  type="button"
                  aria-expanded={mobileCatalogOpen}
                  aria-controls="mobile-catalog-categories"
                  onClick={() =>
                    setMobileCatalogOpen(
                      (value) => !value
                    )
                  }
                  className={`${mobileNavClass} border-b border-border`}
                >
                  <span>Каталог товаров</span>

                  <ChevronDown
                    className={`h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform ${
                      mobileCatalogOpen
                        ? 'rotate-180'
                        : ''
                    }`}
                  />
                </button>

                {mobileCatalogOpen && (
                  <div
                    id="mobile-catalog-categories"
                    className="border-b border-border py-2 pl-3"
                  >
                    {CATEGORIES.map((category) => (
                      <Link
                        key={category.href}
                        href={category.href}
                        onClick={closeMobile}
                        className={`block border-l px-4 py-3 text-[13px] leading-relaxed transition-colors ${
                          isCategoryActive(category.label)
                            ? 'border-foreground font-medium text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {category.label}
                      </Link>
                    ))}
                  </div>
                )}

                <Link
                  href="/#about"
                  onClick={closeMobile}
                  className={`${mobileNavClass} border-b border-border`}
                >
                  <span>О компании</span>

                  <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                </Link>

                <Link
                  href="/contacts"
                  onClick={closeMobile}
                  className={mobileNavClass}
                >
                  <span>Контакты</span>

                  <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                </Link>
              </nav>

              {/* ACCOUNT */}
              <section
                aria-label="Аккаунт"
                className="mt-6 border-t border-border pt-6"
              >
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Аккаунт
                </p>

                {isLoading ? (
                  <div className="h-12 animate-pulse rounded-md bg-muted" />
                ) : user ? (
                  <>
                    {/* ACCOUNT PROFILE */}
                    <Link
                      href="/profile"
                      onClick={closeMobile}
                      className="mb-3 flex min-h-[52px] items-center gap-3 rounded-md transition-colors hover:bg-card/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                        {accountInitial}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {accountName}
                        </span>

                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          Личный кабинет
                        </span>
                      </span>

                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>

                    <Link
                      href="/profile/orders"
                      onClick={closeMobile}
                      className={mobileAccountClass}
                    >
                      <Package className="h-[17px] w-[17px] shrink-0 text-muted-foreground" />

                      <span className="flex-1">
                        Мои заказы
                      </span>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>

                    {isStaff && (
                      <Link
                        href="/admin"
                        onClick={closeMobile}
                        className={mobileAccountClass}
                      >
                        <Settings className="h-[17px] w-[17px] shrink-0 text-muted-foreground" />

                        <span className="flex-1">
                          Админ-панель
                        </span>

                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void handleLogout()
                      }
                      className="mt-2 flex min-h-11 items-center gap-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />

                      Выйти из аккаунта
                    </button>
                  </>
                ) : (
                  <div className="flex gap-3">
                    <Link
                      href="/login"
                      onClick={closeMobile}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
                    >
                      Войти
                    </Link>

                    <Link
                      href="/register"
                      onClick={closeMobile}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-xs font-semibold uppercase tracking-wider text-foreground"
                    >
                      Регистрация
                    </Link>
                  </div>
                )}
              </section>

              {/* PUSH CONTACT TO BOTTOM */}
              <div className="min-h-8 flex-1" />

              {/* CONTACT */}
              <div className="border-t border-border pt-5">
                <a
                  href={PHONE_HREF}
                  onClick={closeMobile}
                  className="flex min-h-[52px] items-center justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Связаться с нами
                    </span>

                    <span className="mt-2 block text-base font-semibold tracking-tight text-foreground">
                      {PHONE}
                    </span>
                  </span>

                  <Phone className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
