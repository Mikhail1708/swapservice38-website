import { productAvailability } from '@/lib/product-availability';
import { SITE_CONTACTS } from '@/lib/site-contacts';


export function ProductEnquiry({
  product,
}: {
  product: {
    name: string;
    sku?: string;
    stock?: number;
    availableStock?: number;
  };
}) {
  if (!productAvailability(product).isOnOrder) return null;

  const buttonClass =
    'inline-flex h-10 items-center justify-center rounded-lg border border-white px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={SITE_CONTACTS.telegram}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
      >
        Написать в Telegram
      </a>

      <a
        href={SITE_CONTACTS.max}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
      >
        Написать в MAX
      </a>

      <a
        href="tel:+79834460888"
        className={buttonClass}
      >
        Позвонить
      </a>
    </div>
  );
}