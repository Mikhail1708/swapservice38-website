import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0a] pt-16 pb-8">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-white/5">
          {/* Логотип */}
          <div>
            <Image 
              src="/images/logo/logo.png" 
              alt="SWAP SERVICE 38" 
              width={160} 
              height={40} 
              className="h-8 w-auto mb-4"
            />
            <p className="text-white/20 text-xs font-light leading-relaxed max-w-xs">
              Инженерный центр по свапу двигателей<br />
              и производству тюнинг-комплектов
            </p>
          </div>

          {/* Компания */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-white/25 font-light mb-6">КОМПАНИЯ</h4>
            <ul className="space-y-3 text-sm text-white/30 font-light">
              <li><Link href="/about" className="hover:text-white/70 transition">О нас</Link></li>
              <li><Link href="/works" className="hover:text-white/70 transition">Наши работы</Link></li>
              <li><Link href="/reviews" className="hover:text-white/70 transition">Отзывы</Link></li>
              <li><Link href="/news" className="hover:text-white/70 transition">Новости</Link></li>
            </ul>
          </div>

          {/* Услуги */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-white/25 font-light mb-6">УСЛУГИ</h4>
            <ul className="space-y-3 text-sm text-white/30 font-light">
              <li><Link href="/services" className="hover:text-white/70 transition">Установка дроп-китов</Link></li>
              <li><Link href="/services" className="hover:text-white/70 transition">Усиление кузовов</Link></li>
              <li><Link href="/services" className="hover:text-white/70 transition">Боди-лифт</Link></li>
              <li><Link href="/services" className="hover:text-white/70 transition">Установка защиты</Link></li>
              <li><Link href="/services" className="hover:text-white/70 transition">Багажники и фаркопы</Link></li>
            </ul>
          </div>

          {/* Контакты */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] uppercase text-white/25 font-light mb-6">КОНТАКТЫ</h4>
            <ul className="space-y-3 text-sm">
              <li className="text-white/60 font-light">+7 (914) 895-58-88</li>
              <li className="text-white/30 font-light">swapservice@yandex.ru</li>
              <li className="text-white/30 text-xs font-light">г. Иркутск, ул. Новаторов 36</li>
              <li className="text-white/20 text-xs font-light pt-2">Ежедневно с 10:00 до 20:00</li>
            </ul>
          </div>
        </div>

        {/* Нижняя часть */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8">
          <p className="text-xs text-white/15 font-light">© 2026 SWAP SERVICE 38</p>
          <Link href="/privacy" className="text-xs text-white/15 hover:text-white/30 transition font-light">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  );
}