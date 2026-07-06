import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const engines = [
    {
      name: '3UZ-FE',
      spec: 'V8 4.3 л',
      desc: 'Легендарный японский V8. Ставим на Nissan Patrol Y60/Y61, Toyota Land Cruiser 80/100, коммерческий транспорт.',
      image: '/images/engines/3uz.jpg'
    },
    {
      name: '5VZ-FE',
      spec: 'V6 3.4 л',
      desc: '«Вечный» мотор для Toyota Hilux, Land Cruiser Prado, 4Runner, Surf. Простой и надёжный.',
      image: '/images/engines/5vz.jpg'
    },
    {
      name: 'VQ35DE',
      spec: 'V6 3.5 л',
      desc: 'Мощный современный мотор от Nissan. Ставим на Patrol, Pathfinder, коммерческий транспорт.',
      image: '/images/engines/vq35.jpg'
    },
  ];

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="min-h-screen flex items-center relative overflow-hidden bg-white">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/service/service-photo.jpg')] bg-cover bg-center opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        </div>

        <div className="container-custom relative z-10 pt-32 pb-20 mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="max-w-3xl mx-auto lg:mx-0">
            <div className="mb-8 flex justify-center lg:justify-start">
              <Image 
                src="/images/logo/logo.png" 
                alt="SWAP SERVICE 38" 
                width={300} 
                height={80}
                className="h-16 w-auto brightness-0"
                priority
              />
            </div>

            <div className="flex gap-3 flex-wrap justify-center lg:justify-start mb-6">
              <span className="text-[11px] tracking-[0.25em] text-gray-500 uppercase font-medium border border-gray-200 px-4 py-1.5 rounded-full">10+ ЛЕТ ОПЫТА</span>
              <span className="text-[11px] tracking-[0.25em] text-gray-500 uppercase font-medium border border-gray-200 px-4 py-1.5 rounded-full">500+ АВТОМОБИЛЕЙ</span>
            </div>

            <h1 className="text-center lg:text-left text-[clamp(48px,10vw,100px)] font-bold leading-[0.95] tracking-[-0.04em] mb-6 text-black">
              СВАПЫ<br />
              <span className="text-[clamp(48px,10vw,100px)] font-bold leading-[0.95] tracking-[-0.04em] text-black">ДВИГАТЕЛЕЙ</span>
            </h1>

            <p className="text-center lg:text-left text-lg text-gray-600 max-w-lg mx-auto lg:mx-0 font-light leading-relaxed mb-10">
              Профессиональная замена двигателей на <span className="text-black font-medium">3UZ</span>,{' '}
              <span className="text-black font-medium">5VZ</span>, <span className="text-black font-medium">VQ35</span>,{' '}
              Собственное производство свап-комплектов, 10 лет успешной работы.
            </p>

            <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-20">
              <Link href="/swaps" className="px-10 py-4 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition">
                Посмотреть свапы
              </Link>
              <Link href="/contacts" className="px-10 py-4 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition">
                Консультация
              </Link>
            </div>

            <div className="flex justify-center lg:justify-start gap-16 flex-wrap border-t border-gray-200 pt-8">
              <div className="text-center lg:text-left">
                <div className="text-3xl font-bold text-black">10+</div>
                <span className="text-[11px] tracking-[0.2em] text-gray-400 uppercase font-medium">лет опыта</span>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-3xl font-bold text-black">500+</div>
                <span className="text-[11px] tracking-[0.2em] text-gray-400 uppercase font-medium">автомобилей</span>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-3xl font-bold text-black">3</div>
                <span className="text-[11px] tracking-[0.2em] text-gray-400 uppercase font-medium">основных мотора</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== О НАС ===== */}
      <section className="py-28 bg-gray-50 border-t border-gray-200">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">О КОМПАНИИ</span>
              <h2 className="text-[clamp(32px,4vw,48px)] font-bold mt-4 text-black">
                Сервесный центр по свапу двигателей<br />
                <span className="text-[clamp(32px,4vw,48px)] font-bold mt-4 text-black">и производству тюнинг-компонентов</span>
              </h2>
            </div>

            <div className="space-y-6 text-gray-600 font-light leading-relaxed text-base max-w-3xl mx-auto text-center">
              <p className="text-gray-600">
                <span className="text-black font-medium">SWAPSERVICE38</span> — это команда инженеров и механиков, которая с <span className="text-black font-medium">2016 года</span> занимается сложными свапами двигателей, ремонтом внедорожников и производством собственных тюнинг-комплектов. Начав с небольшого гаража, мы выросли в полноценный инженерный центр с собственным боксом, сварочным постом и штатом конструкторов.
              </p>
              <p className="text-gray-600">
                Мы ставим легендарные моторы <span className="text-black font-medium">3UZ, 5VZ, VQ35</span> на Toyota, Nissan, Land Rover и коммерческий транспорт. Проектируем и производим собственные свап-киты, дроп-киты, защиты и усиления. Полный цикл — от идеи до выезда на тест-драйв.
              </p>
              <p className="text-gray-600">
                Каждый проект мы доводим до ума: обкатка, тест-драйв, финальная настройка. Только после этого машина возвращается клиенту.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto">
              {['3UZ', '5VZ', 'VQ35'].map((m) => (
                <div key={m} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-gray-400 transition text-center">
                  <div className="text-2xl font-bold text-black">{m}</div>
                  <div className="text-xs text-gray-400 mt-1 font-medium">
                    {m === '3UZ' ? 'V8 4.3 л' : m === '5VZ' ? 'V6 3.4 л' : m === 'VQ35' ? 'V6 3.5 л' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== ПОПУЛЯРНЫЕ СВАПЫ ===== */}
      <section className="py-28 border-t border-gray-200">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="text-center mb-16">
            <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">ДВИГАТЕЛИ</span>
            <h2 className="text-[clamp(32px,4vw,48px)] font-bold mt-2 text-black">Популярные моторы для свапа</h2>
            <p className="text-gray-500 font-light max-w-2xl mx-auto mt-4">
              Устанавливаем наиболее надёжные и популярные двигатели на любые автомобили.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {engines.map((engine, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-400 transition group">
                <div className="h-48 bg-gray-100 relative overflow-hidden">
                  <Image 
                    src={engine.image} 
                    alt={engine.name} 
                    fill 
                    className="object-cover group-hover:scale-105 transition duration-500" 
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-bold text-black">{engine.name}</h3>
                    <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-medium">{engine.spec}</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-3 font-light leading-relaxed">{engine.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ПРОИЗВОДСТВО ===== */}
      <section className="py-28 bg-gray-50 border-t border-gray-200">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">ПРОИЗВОДСТВО</span>
            <h2 className="text-[clamp(32px,4vw,48px)] font-bold mt-2 mb-4 text-black">
              Навесной тюнинг и <span className="text-[clamp(32px,4vw,48px)] font-bold mt-2 mb-4 text-black">индивидуальные проекты</span>
            </h2>
            <p className="text-gray-500 font-light leading-relaxed">
              Собственное производство запчастей и аксессуаров. Разрабатываем и изготавливаем то, чего нет в магазинах.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden max-w-4xl mx-auto">
            {[
              { icon: '🛡️', name: 'Защита', desc: 'Картер, раздатка, мосты' },
              { icon: '⬆️', name: 'Боди-лифт', desc: 'Поднятие кузова до 50 мм' },
              { icon: '🧳', name: 'Багажники', desc: 'Крышные, навесные' },
              { icon: '⚙️', name: 'Свап-киты', desc: 'Крепления, адаптеры' },
            ].map((item) => (
              <div key={item.name} className="bg-white p-8 text-center hover:bg-gray-50 transition">
                <div className="text-3xl mb-3 opacity-40">{item.icon}</div>
                <h3 className="text-sm font-semibold text-black">{item.name}</h3>
                <p className="text-gray-400 text-xs font-light mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/catalog" className="inline-block px-10 py-4 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition">
              Перейти в каталог
            </Link>
          </div>
        </div>
      </section>

      {/* ===== КАРТА ===== */}
      <section className="py-28 border-t border-gray-200">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">МЫ НА КАРТЕ</span>
            <h2 className="text-[clamp(28px,3vw,40px)] font-bold mt-2 text-black">Как нас найти</h2>
            <p className="text-gray-500 font-light mt-4 text-lg">
              г. Иркутск, ул. Новаторов 36
            </p>
          </div>

          <div className="relative w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 max-w-6xl mx-auto">
            <iframe
              src="https://yandex.ru/map-widget/v1/?um=constructor%3A8f2f6a0b8a1d4a0a9c9e8f7d6c5b4a3a&amp;source=constructor&amp;pt=104.216053,52.363528&amp;zoom=17"
              width="100%"
              height="100%"
              frameBorder="0"
              className="filter grayscale hover:grayscale-0 transition duration-700"
              allowFullScreen
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mt-8 max-w-4xl mx-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center hover:border-gray-400 transition">
              <div className="text-2xl mb-2">📍</div>
              <p className="text-gray-600 text-sm font-light">г. Иркутск, ул. Новаторов 36</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center hover:border-gray-400 transition">
              <div className="text-2xl mb-2">📞</div>
              <a href="tel:+79148955888" className="text-gray-600 hover:text-black transition text-sm font-light">+7 (914) 895-58-88</a>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center hover:border-gray-400 transition">
              <div className="text-2xl mb-2">🕐</div>
              <p className="text-gray-600 text-sm font-light">Ежедневно с 10:00 до 20:00</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-28 bg-gray-50 border-t border-gray-200">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl text-center max-w-4xl mx-auto">
          <h2 className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.03em] mb-6 text-black">
            Готовы к <span className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.03em] text-black">свапу</span> или
            <br />
            нужен <span className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.03em] text-black">ремонт</span>?
          </h2>
          <p className="text-gray-500 text-base mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Приезжайте на консультацию. Расскажем, что можно сделать с вашим автомобилем.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contacts" className="px-10 py-4 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition">
              Записаться на консультацию
            </Link>
            <Link href="/swaps" className="px-10 py-4 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition">
              Посмотреть проекты
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}