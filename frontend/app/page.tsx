// frontend/app/page.tsx
import { Hero } from '@/components/hero';
import { FeatureStrip } from '@/components/feature-strip';
import { Services } from '@/components/services';
import { Products } from '@/components/products';
import { About } from '@/components/about';
import { WhyUs } from '@/components/why-us';
import { Cta } from '@/components/cta';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SWAP SERVICE 38 — Тюнинг и обслуживание внедорожников',
  description: 'Собственное производство тюнинг-компонентов, свап двигателей, установка защиты, боди-лифт и обслуживание внедорожников в Иркутске.',
  openGraph: {
    title: 'SWAP SERVICE 38 — Тюнинг и обслуживание внедорожников',
    description: 'Собственное производство тюнинг-компонентов, свап двигателей, установка защиты, боди-лифт и обслуживание внедорожников в Иркутске.',
    url: 'https://swapservice38.ru',
    siteName: 'SWAP SERVICE 38',
    images: [
      {
        url: '/images/logo/logo.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'ru_RU',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: 'https://swapservice38.ru',
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <Services />
      <Products />
      <About />
      <WhyUs />
      <Cta />
    </>
  );
}