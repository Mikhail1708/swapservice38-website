import type { Metadata, Viewport } from 'next';
import { Inter, Oswald } from 'next/font/google';
import './globals.css';
import { Providers } from './providers'; // 👈 ДОБАВЛЯЕМ ИМПОРТ
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SWAP SERVICE 38 — Тюнинг и обслуживание внедорожников',
  description:
    'Собственное производство тюнинг-компонентов, свап двигателей, установка защиты, боди-лифт и обслуживание внедорожников в Иркутске.',
};

export const viewport: Viewport = {
  themeColor: '#0c0c0d',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="bg-background">
      <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
        <Providers> {/* 👈 ОБЁРТЫВАЕМ ВСЁ В PROVIDERS */}
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}