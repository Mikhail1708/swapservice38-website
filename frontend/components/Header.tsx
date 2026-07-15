'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  ShoppingCart, 
  User, 
  Menu, 
  X, 
  LogOut, 
  Settings, 
  Package,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCart } from '@/lib/hooks/useCart';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, logout } = useAuth();
  const { itemsCount, refetch } = useCart();

  useEffect(() => {
    refetch();
  }, [refetch, pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        const menuButton = document.getElementById('mobile-menu-button');
        if (menuButton && !menuButton.contains(target)) {
          setIsMobileMenuOpen(false);
        }
      }
    };
    
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
  };

  const handleMouseEnter = (name: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setOpenDropdown(name);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
    setHoverTimeout(timeout);
  };

  const handleDropdownMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };

  const handleDropdownMouseLeave = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
    setHoverTimeout(timeout);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isCategoryActive = (categoryLabel: string) => {
    const categoryFromUrl = searchParams?.get('category') || '';
    return categoryFromUrl === categoryLabel;
  };

  const categories = [
    { label: 'Все товары', href: '/catalog' },
    { label: 'Компоненты для свапа', href: '/catalog?category=Компоненты для свапа' },
    { label: 'Компоненты для свапа РАЗНОЕ', href: '/catalog?category=Компоненты для свапа РАЗНОЕ' },
    { label: 'Компоненты для подвески, лифт комплекты', href: '/catalog?category=Компоненты для подвески, лифт комплекты' },
    { label: 'Внешний обвес', href: '/catalog?category=Внешний обвес' },
    { label: 'TLC80', href: '/catalog?category=TLC80' },
    { label: 'Свап-кит SC 3UZ', href: '/catalog?category=Свап-кит SC 3UZ' },
    { label: 'Компоненты для джипов РАЗНОЕ', href: '/catalog?category=Компоненты для джипов РАЗНОЕ' },
  ];

  const serviceItems = [
    { label: 'Все услуги', href: '/services' },
    { label: 'Свапы двигателей', href: '/swaps' },
    { label: 'Боди-лифт', href: '/services#bodylift' },
    { label: 'Усиление кузова', href: '/services#reinforcement' },
    { label: 'Установка защиты', href: '/services#protection' },
    { label: 'Установка багажников', href: '/services#racks' },
    { label: 'Диагностика', href: '/services#diagnostics' },
    { label: 'Ремонт внедорожников', href: '/services#repair' },
  ];

  const simpleLinks = [
    { href: '/', label: 'Главная' },
  ];

  const contactsLink = { href: '/contacts', label: 'Контакты' };

  const handleCategoryClick = (href: string) => {
    setOpenDropdown(null);
    router.push(href);
  };

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200 py-3' 
        : 'bg-white border-b border-gray-200 py-4'
    }`}>
      <div className="container-custom flex justify-between items-center">
        {/* Логотип */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <Image 
            src="/images/logo/logo.png" 
            alt="SWAP SERVICE 38" 
            width={300} 
            height={300} 
            className="h-10 w-auto brightness-0"
            priority
          />
          <span className="text-[10px] tracking-[0.2em] text-gray-400 border-l border-gray-200 pl-3 hidden sm:inline-block">
            EST. 2016
          </span>
        </Link>

        {/* ===== ДЕСКТОПНАЯ НАВИГАЦИЯ ===== */}
        <nav className="hidden lg:flex items-center gap-6">
          {simpleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition whitespace-nowrap ${
                pathname === link.href
                  ? 'text-black border-b border-black/30 pb-0.5 font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Каталог */}
          <div
            ref={(el) => { dropdownRefs.current['Каталог'] = el; }}
            className="relative"
            onMouseEnter={() => handleMouseEnter('Каталог')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 text-sm transition whitespace-nowrap ${
                pathname?.startsWith('/catalog')
                  ? 'text-black font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              Каталог
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openDropdown === 'Каталог' ? 'rotate-180' : ''
              }`} />
            </button>

            {openDropdown === 'Каталог' && (
              <div 
                className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden py-2 z-50 max-h-[400px] overflow-y-auto"
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                {categories.map((subItem) => {
                  const isActive = subItem.label === 'Все товары' 
                    ? pathname === '/catalog' && !searchParams?.get('category')
                    : isCategoryActive(subItem.label);
                  
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`block px-4 py-2.5 text-sm transition hover:bg-gray-50 ${
                        isActive
                          ? 'text-black bg-gray-50 font-medium'
                          : 'text-gray-500 hover:text-black'
                      }`}
                      onClick={() => handleCategoryClick(subItem.href)}
                    >
                      {subItem.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Услуги */}
          <div
            ref={(el) => { dropdownRefs.current['Услуги'] = el; }}
            className="relative"
            onMouseEnter={() => handleMouseEnter('Услуги')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 text-sm transition whitespace-nowrap ${
                pathname?.startsWith('/services') || pathname?.startsWith('/swaps')
                  ? 'text-black font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              Услуги
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openDropdown === 'Услуги' ? 'rotate-180' : ''
              }`} />
            </button>

            {openDropdown === 'Услуги' && (
              <div 
                className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden py-2 z-50"
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                {serviceItems.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={`block px-4 py-2.5 text-sm transition hover:bg-gray-50 ${
                      pathname === subItem.href
                        ? 'text-black bg-gray-50 font-medium'
                        : 'text-gray-500 hover:text-black'
                    }`}
                    onClick={() => setOpenDropdown(null)}
                  >
                    {subItem.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Контакты */}
          <Link
            href={contactsLink.href}
            className={`text-sm transition whitespace-nowrap ${
              pathname === contactsLink.href
                ? 'text-black border-b border-black/30 pb-0.5 font-medium'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            {contactsLink.label}
          </Link>
        </nav>

        {/* ===== ПРАВАЯ ЧАСТЬ ===== */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/cart" className="relative p-2 rounded-full hover:bg-gray-100 transition">
            <ShoppingCart className="h-5 w-5 text-gray-600 hover:text-black transition" />
            {itemsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-medium text-white transition-all duration-200">
                {itemsCount > 99 ? '99+' : itemsCount}
              </span>
            )}
          </Link>

          {isLoading ? (
            <div className="w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden md:inline text-sm text-gray-700 font-medium">
                  {user.firstName || user.email?.split('@')[0]}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm font-medium text-black">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 hover:text-black transition"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Профиль
                    </Link>
                    <Link
                      href="/profile/orders"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 hover:text-black transition"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Package className="h-4 w-4" />
                      Мои заказы
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 hover:text-black transition"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Админка
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition"
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
                className="px-4 py-2 text-sm text-gray-500 hover:text-black transition"
              >
                Войти
              </Link>
              <Link 
                href="/register" 
                className="px-5 py-2 text-sm bg-black text-white rounded-full font-medium hover:bg-gray-800 transition"
              >
                Регистрация
              </Link>
            </div>
          )}

          <button
            id="mobile-menu-button"
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition relative z-[60]"
            aria-label="Меню"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5 text-black" /> : <Menu className="h-5 w-5 text-black" />}
          </button>
        </div>
      </div>

      {/* ===== МОБИЛЬНОЕ МЕНЮ ===== */}
      <div
        className={`lg:hidden fixed inset-0 z-[55] transition-all duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: isScrolled ? '60px' : '72px' }}
      >
        <div 
          className="absolute inset-0 bg-black/30"
          onClick={closeMobileMenu}
        />
        
        <div 
          ref={mobileMenuRef}
          className={`absolute right-0 top-0 w-full max-w-sm h-full bg-white shadow-2xl transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full overflow-y-auto px-6 py-6 space-y-1">
            <Link
              href="/"
              className={`block py-3 text-sm transition ${
                pathname === '/' ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
              }`}
              onClick={closeMobileMenu}
            >
              Главная
            </Link>

            <div className="space-y-1">
              <div className="text-sm font-medium text-black py-3 border-b border-gray-100">
                Каталог
              </div>
              {categories.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-2 pl-4 text-sm text-gray-500 hover:text-black transition"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="space-y-1 mt-2">
              <div className="text-sm font-medium text-black py-3 border-b border-gray-100">
                Услуги
              </div>
              {serviceItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-2 pl-4 text-sm text-gray-500 hover:text-black transition"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <Link
              href="/contacts"
              className={`block py-3 text-sm transition ${
                pathname === '/contacts' ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
              }`}
              onClick={closeMobileMenu}
            >
              Контакты
            </Link>

            {!user && !isLoading && (
              <>
                <div className="h-px bg-gray-200 my-3" />
                <Link
                  href="/login"
                  className="block py-3 text-sm text-gray-500 hover:text-black transition"
                  onClick={closeMobileMenu}
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="block py-3 text-sm text-black font-medium hover:text-gray-700 transition"
                  onClick={closeMobileMenu}
                >
                  Регистрация
                </Link>
              </>
            )}
            {user && (
              <>
                <div className="h-px bg-gray-200 my-3" />
                <Link
                  href="/profile"
                  className="block py-3 text-sm text-gray-500 hover:text-black transition"
                  onClick={closeMobileMenu}
                >
                  Профиль
                </Link>
                <Link
                  href="/profile/orders"
                  className="block py-3 text-sm text-gray-500 hover:text-black transition"
                  onClick={closeMobileMenu}
                >
                  Мои заказы
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    closeMobileMenu();
                  }}
                  className="block w-full text-left py-3 text-sm text-red-500 hover:text-red-600 transition"
                >
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}