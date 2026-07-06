// app/(public)/contacts/page.tsx
import Link from 'next/link';

export default function ContactsPage() {
  return (
    <div className="container-custom py-32 mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-16 text-center">
          <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">КОНТАКТЫ</span>
          <h1 className="text-4xl font-bold mt-2 text-black">Свяжитесь с нами</h1>
          <p className="text-gray-500 font-light mt-4">
            Мы всегда на связи. Звоните, пишите, приезжайте!
          </p>
        </div>

        {/* Контакты */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Адрес */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-gray-400 transition">
            <div className="text-3xl mb-4">📍</div>
            <h3 className="text-lg font-medium text-black mb-2">Адрес</h3>
            <p className="text-gray-600 font-light">г. Иркутск, ул. Новаторов 36</p>
          </div>

          {/* Режим работы */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-gray-400 transition">
            <div className="text-3xl mb-4">🕐</div>
            <h3 className="text-lg font-medium text-black mb-2">Режим работы</h3>
            <p className="text-gray-600 font-light">Ежедневно с 10:00 до 20:00</p>
            <p className="text-gray-400 text-sm mt-2 font-light">Без выходных</p>
          </div>

          {/* Email */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-gray-400 transition">
            <div className="text-3xl mb-4">📧</div>
            <h3 className="text-lg font-medium text-black mb-2">Email</h3>
            <a href="mailto:swapservice@yandex.ru" className="text-gray-600 hover:text-black transition font-light">
              swapservice38@yandex.ru
            </a>
          </div>

          {/* Телефоны */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-gray-400 transition">
            <div className="text-3xl mb-4">📞</div>
            <h3 className="text-lg font-medium text-black mb-4">Телефоны</h3>
            <div className="space-y-4">
              <div>
                <a href="tel:+79245330880" className="text-black hover:text-gray-600 transition font-light text-lg block">
                  +7 (924) 533-08-80
                </a>
                <p className="text-gray-400 text-sm font-light">Николай — вопросы по свапу</p>
              </div>
              <div>
                <a href="tel:+79834460888" className="text-black hover:text-gray-600 transition font-light text-lg block">
                  +7 (983) 446-08-88
                </a>
                <p className="text-gray-400 text-sm font-light">Александр — магазин тюнинга</p>
              </div>
              <div>
                <a href="tel:+79148955888" className="text-black hover:text-gray-600 transition font-light text-lg block">
                  +7 (914) 895-58-88
                </a>
                <p className="text-gray-400 text-sm font-light">Сервис</p>
              </div>
            </div>
          </div>
        </div>

        {/* Соцсети */}
        <div className="mt-16 text-center">
          <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">МЫ В СОЦСЕТЯХ</span>
          <h2 className="text-2xl font-bold mt-2 text-black">Подписывайтесь на нас</h2>
          <p className="text-gray-500 font-light mt-4 mb-8">
            Смотрите наши проекты, процесс работы и готовые результаты
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://t.me/swap38"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 hover:border-gray-400 transition"
            >
              <span className="text-2xl">📱</span>
              <span className="text-black font-medium">Telegram</span>
            </a>
            <a
              href="https://www.instagram.com/swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 hover:border-gray-400 transition"
            >
              <span className="text-2xl">📸</span>
              <span className="text-black font-medium">Instagram</span>
            </a>
            <a
              href="https://youtube.com/@swapservice38"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 hover:border-gray-400 transition"
            >
              <span className="text-2xl">▶️</span>
              <span className="text-black font-medium">YouTube</span>
            </a>
          </div>
        </div>

        {/* Карта */}
        <div className="mt-16">
          <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
            <iframe
              src="https://yandex.ru/map-widget/v1/?um=constructor%3A8f2f6a0b8a1d4a0a9c9e8f7d6c5b4a3a&amp;source=constructor&amp;pt=104.216053,52.363528&amp;zoom=17"
              width="100%"
              height="100%"
              frameBorder="0"
              className="filter grayscale hover:grayscale-0 transition duration-700"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}