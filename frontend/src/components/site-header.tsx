// frontend/components/site-header.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Image, Link, usePathname, useRouter, useSearchParams } from '@/lib/next-shims';
import { Menu, Phone, X, ShoppingCart, User, ChevronDown, LogOut, Settings, Package } from 'lucide-react';
import { useAuth }  from '@/lib/hooks/useAuth';
import { useCart }  from '@/lib/context/CartContext';

// Категории для выпадающего меню
const CATEGORIES = [
  { label: 'Все товары', href: '/catalog' },
  { label: 'Компоненты для свапа', href: '/catalog?category=Компоненты для свапа' },
  { label: 'Компоненты для свапа РАЗНОЕ', href: '/catalog?category=Компоненты для свапа РАЗНОЕ' },
  { label: 'Компоненты для подвески, лифт комплекты', href: '/catalog?category=Компоненты для подвески, лифт комплекты' },
  { label: 'Внешний обвес', href: '/catalog?category=Внешний обвес' },
  { label: 'TLC80', href: '/catalog?category=TLC80' },
  { label: 'Свап-кит SC 3UZ', href: '/catalog?category=Свап-кит SC 3UZ' },
  { label: 'Компоненты для джипов РАЗНОЕ', href: '/catalog?category=Компоненты для джипов РАЗНОЕ' },
];

// Навигация
const NAV = [
  { label: 'Услуги', href: '/services' },
  { label: 'Каталог', href: '/catalog' },
  { label: 'О нас', href: '/#about' },
  { label: 'Контакты', href: '/contacts' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  
  const catalogRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, logout } = useAuth();
  const { itemsCount, refetch: refetchCart } = useCart();

  // Обновляем корзину при монтировании и при изменении пути
  useEffect(() => {
    refetchCart();
  }, [pathname, refetchCart]);

  // Анимация при изменении количества
  useEffect(() => {
    if (itemsCount > 0) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 300);
      return () => clearTimeout(timer);
    }
  }, [itemsCount]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/#about') return pathname === '/';
    if (href === '/catalog') return pathname?.startsWith('/catalog');
    if (href === '/services') return pathname?.startsWith('/services') || pathname?.startsWith('/swaps');
    return pathname?.startsWith(href);
  };

  const isCategoryActive = (categoryLabel: string) => {
    const categoryFromUrl = searchParams?.get('category') || '';
    return categoryFromUrl === categoryLabel;
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsDropdownOpen(false);
      setOpen(false);
      router.replace('/');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось выйти');
    }
  };

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(event.target as Node)) {
        setIsCatalogOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Обработчики для каталога
  const handleCatalogMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCatalogOpen(true);
  };

  const handleCatalogMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsCatalogOpen(false);
    }, 150);
  };

  const handleCatalogClick = () => {
    setIsCatalogOpen(!isCatalogOpen);
  };

  const closeCatalog = () => {
    setIsCatalogOpen(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-custom flex h-20 items-center justify-between gap-4">
        {/* Логотип */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo/logo.png"
            alt="SWAP SERVICE 38"
            width={44}
            height={44}
            className="h-10 w-10 object-contain brightness-0 invert"
          />
          <span className="heading-display text-lg leading-none tracking-tight text-foreground hidden sm:inline">
            SWAP SERVICE 38
          </span>
        </Link>

        {/* ===== ДЕСКТОПНАЯ НАВИГАЦИЯ ===== */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => {
            // Для "Каталог" показываем с выпадашкой
            if (item.label === 'Каталог') {
              return (
                <div
                  key={item.href}
                  ref={catalogRef}
                  className="relative"
                  onMouseEnter={handleCatalogMouseEnter}
                  onMouseLeave={handleCatalogMouseLeave}
                >
                  <button
                    onClick={handleCatalogClick}
                    className={`flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] transition-colors cursor-pointer ${
                      isActive(item.href)
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Каталог
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isCatalogOpen ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {isCatalogOpen && (
                    <div 
                      className="absolute top-full left-0 mt-1 min-w-[240px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden py-2 z-50"
                      onMouseEnter={handleCatalogMouseEnter}
                      onMouseLeave={handleCatalogMouseLeave}
                    >
                      {CATEGORIES.map((subItem) => {
                        const isActiveCat = subItem.label === 'Все товары' 
                          ? pathname === '/catalog' && !searchParams?.get('category')
                          : isCategoryActive(subItem.label);
                        
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`block px-5 py-2.5 text-sm transition-all duration-150 ${
                              isActiveCat
                                ? 'text-foreground bg-muted font-medium'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                            onClick={closeCatalog}
                          >
                            {subItem.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Остальные пункты — обычные ссылки
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

        {/* ===== ПРАВАЯ ЧАСТЬ ===== */}
        <div className="flex items-center gap-4">
          {/* Телефон */}
          <div className="hidden text-right md:block">
            <a
              href="tel:+79148993838"
              className="block text-sm font-semibold text-foreground"
            >
              +7 (914) 895-58-88
            </a>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Ежедневно с 10:00 до 20:00
            </span>
          </div>

          {/* Корзина */}
          <Link
            href="/cart"
            className="relative p-2 rounded-lg hover:bg-muted transition-colors group"
          >
            <ShoppingCart className={`h-5 w-5 text-muted-foreground hover:text-foreground transition ${
              cartBounce ? 'scale-110' : 'scale-100'
            }`} />
            
            {itemsCount > 0 && (
              <span className={`
                absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full 
                bg-primary text-[10px] font-medium text-primary-foreground
                transition-all duration-300
                ${cartBounce ? 'scale-125' : 'scale-100'}
              `}>
                {itemsCount > 99 ? '99+' : itemsCount}
              </span>
            )}
          </Link>

          {/* Авторизация */}
          {isLoading ? (
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition"
              >
                <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-sm font-medium text-background">
                    {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden md:inline text-sm text-foreground font-medium">
                  {user.firstName || user.email?.split('@')[0]}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Профиль
                    </Link>
                    <Link
                      href="/profile/orders"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Package className="h-4 w-4" />
                      Мои заказы
                    </Link>
                    {['admin', 'manager'].includes(user.role) && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Админка
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      Выйти
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Регистрация
              </Link>
            </div>
          )}

          {/* Мобильное меню */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border text-foreground lg:hidden"
            aria-label="Открыть меню"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ===== МОБИЛЬНОЕ МЕНЮ ===== */}
      {open && (
        <div className="border-t border-border bg-background lg:hidden max-h-[80vh] overflow-y-auto">
          <nav className="container-custom flex flex-col py-4">
            {NAV.map((item) => {
              if (item.label === 'Каталог') {
                return (
                  <div key={item.href} className="border-b border-border py-3">
                    <div className="text-sm font-medium uppercase tracking-[0.12em] text-foreground mb-2">
                      Каталог
                    </div>
                    <div className="space-y-1 pl-4">
                      {CATEGORIES.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className="block py-2 text-sm text-muted-foreground hover:text-foreground transition"
                          onClick={() => setOpen(false)}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`border-b border-border py-3 text-sm font-medium uppercase tracking-[0.12em] ${
                    isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <a
              href="tel:+79148993838"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <Phone className="h-4 w-4" /> +7 (914) 895-58-88
            </a>

            {!user && !isLoading && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="text-sm text-foreground font-medium hover:text-muted-foreground transition"
                >
                  Регистрация
                </Link>
              </div>
            )}
            {user && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Профиль
                </Link>
                <Link
                  href="/profile/orders"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Мои заказы
                </Link>
                {['admin', 'manager'].includes(user.role) && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    Админка
                  </Link>
                )}
                <button
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="text-sm text-red-500 hover:text-red-400 transition text-left"
                >
                  Выйти
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
