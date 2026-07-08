'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { itemsCount, refetch } = useCart();

  // Обновляем корзину при монтировании и при изменении пути
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

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
    router.push('/');
  };

  const links = [
    { href: '/', label: 'Главная' },
    { href: '/swaps', label: 'Свапы' },
    { href: '/services', label: 'Автосервис' },
    { href: '/catalog', label: 'Продукция' },
    { href: '/contacts', label: 'Контакты' },
  ];

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200 py-3' 
        : 'bg-white border-b border-gray-200 py-4'
    }`}>
      <div className="container-custom flex justify-between items-center">
        {/* Логотип */}
        <Link href="/" className="flex items-center gap-3">
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

        {/* Навигация */}
        <nav className="hidden md:flex gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition ${
                pathname === link.href
                  ? 'text-black border-b border-black/30 pb-0.5 font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Правая часть */}
        <div className="flex items-center gap-3">
          {/* Корзина */}
          <Link href="/cart" className="relative p-2 rounded-full hover:bg-gray-100 transition">
            <ShoppingCart className="h-5 w-5 text-gray-600 hover:text-black transition" />
            {itemsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-medium text-white transition-all duration-200">
                {itemsCount > 99 ? '99+' : itemsCount}
              </span>
            )}
          </Link>

          {/* Авторизация */}
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

          {/* Мобильное меню */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="Меню"
          >
            {isOpen ? <X className="h-5 w-5 text-black" /> : <Menu className="h-5 w-5 text-black" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-[500px] border-t border-gray-200' : 'max-h-0'
        }`}
      >
        <div className="bg-white px-6 py-6 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block py-3 text-sm transition ${
                pathname === link.href ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
              }`}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {!user && !isLoading && (
            <>
              <div className="h-px bg-gray-200 my-3" />
              <Link
                href="/login"
                className="block py-3 text-sm text-gray-500 hover:text-black transition"
                onClick={() => setIsOpen(false)}
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="block py-3 text-sm text-black font-medium hover:text-gray-700 transition"
                onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
              >
                Профиль
              </Link>
              <Link
                href="/profile/orders"
                className="block py-3 text-sm text-gray-500 hover:text-black transition"
                onClick={() => setIsOpen(false)}
              >
                Мои заказы
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="block w-full text-left py-3 text-sm text-red-500 hover:text-red-600 transition"
              >
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}