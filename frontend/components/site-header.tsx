'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Phone, X, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCart } from '@/lib/hooks/useCart';

const NAV = [
  { label: 'Услуги', href: '/services' },
  { label: 'Каталог', href: '/catalog' },
  { label: 'О нас', href: '/#about' },
  { label: 'Контакты', href: '/contacts' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { itemsCount } = useCart();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/#about') return pathname === '/';
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
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

        {/* Навигация */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                isActive(item.href)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Правая часть */}
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
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ShoppingCart className="h-5 w-5 text-muted-foreground hover:text-foreground transition" />
            {itemsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {itemsCount > 99 ? '99+' : itemsCount}
              </span>
            )}
          </Link>

          {/* Авторизация */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user.firstName || 'Профиль'}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Выйти
              </button>
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

      {/* Мобильное меню */}
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="container-custom flex flex-col py-4">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3 text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                {item.label}
              </Link>
            ))}
            <a
              href="tel:+79148993838"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <Phone className="h-4 w-4" /> +7 (914) 899-38-38
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}