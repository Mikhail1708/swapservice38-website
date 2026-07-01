'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function Header() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Главная' },
    { href: '/swaps', label: 'Свапы' },
    { href: '/services', label: 'Автосервис' },
    { href: '/catalog', label: 'Производство' },
    { href: '/contacts', label: 'Контакты' },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-50 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
      <div className="container-custom flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          {/* Логотип — пробуем PNG, если нет — SVG */}
          <Image 
            src="/images/logo/logo.png" 
            alt="SWAP SERVICE 38" 
            width={200} 
            height={50} 
            className="h-10 w-auto"
            priority
          />
          <span className="text-[10px] tracking-[0.2em] text-white/20 border-l border-white/10 pl-3 hidden sm:inline-block">
            EST. 2016
          </span>
        </Link>

        <nav className="hidden md:flex gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition ${
                pathname === link.href
                  ? 'text-white border-b border-white/30 pb-0.5'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/40 hover:text-white/70 transition">
            Войти
          </Link>
          <Link href="/register" className="text-sm bg-white text-black px-5 py-2 rounded-full font-medium hover:bg-white/90 transition">
            Регистрация
          </Link>
        </div>
      </div>
    </header>
  );
}