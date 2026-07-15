import { Hero } from '@/components/hero';
import { FeatureStrip } from '@/components/feature-strip';
import { Services } from '@/components/services';
import { Products } from '@/components/products';
import { About } from '@/components/about';
import { WhyUs } from '@/components/why-us';
import { Cta } from '@/components/cta';

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