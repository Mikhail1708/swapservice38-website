import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 pt-16 pb-8">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-gray-200">
          <div>
            <Image 
              src="/images/logo/logo.png" 
              alt="SWAP SERVICE 38" 
              width={500} 
              height={500} 
              className="h-8 w-auto brightness-0"
            />
          </div>

          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium mb-6">КОМПАНИЯ</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-light">
              <li><Link href="/about" className="hover:text-black transition">О нас</Link></li>
              <li><Link href="/swaps" className="hover:text-black transition">Наши работы</Link></li>
              <li><Link href="/reviews" className="hover:text-black transition">Отзывы</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium mb-6">УСЛУГИ</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-light">
              <li><Link href="/swaps" className="hover:text-black transition">Свап любой сложности</Link></li>
              <li><Link href="/services" className="hover:text-black transition">Усиление кузовов</Link></li>
              <li><Link href="/services" className="hover:text-black transition">Тюнинг и ремонт внедорожников</Link></li>
              <li><Link href="/services" className="hover:text-black transition">Установка защиты</Link></li>
              <li><Link href="/services" className="hover:text-black transition">Реализация нестандартных технических задач</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium mb-6">КОНТАКТЫ</h4>
            <ul className="space-y-3 text-sm">
              <li className="text-gray-600 font-light">+7 (914) 895-58-88</li>
              <li className="text-gray-600 font-light">swapservice38@yandex.ru</li>
              <li className="text-gray-600 font-light">г. Иркутск, ул. Новаторов 36</li>
              <li className="text-gray-600 font-light">Ежедневно с 10:00 до 20:00</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8">
          <p className="text-xs text-gray-400 font-light">© 2026 SWAPSERVICE38</p>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-black transition font-light">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  );
}