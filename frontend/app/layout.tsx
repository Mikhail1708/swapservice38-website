// frontend/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SWAPSERVICE38 — Свап двигателей и тюнинг внедорожников',
  description: 'Профессиональный свап двигателей, тюнинг и ремонт внедорожников в Иркутске. Установка 3UZ, 5VZ, VQ35 и других моторов.',
  keywords: 'свап двигателей, тюнинг внедорожников, замена двигателя, Иркутск, Nissan Patrol, Toyota Land Cruiser, 3UZ, 5VZ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}