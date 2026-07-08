// app/services/page.tsx
import Link from 'next/link';

export default function ServicesPage() {
  const services = [
    { 
      name: 'Свапы двигателей', 
      desc: 'Замена двигателя на 3UZ, 5VZ, VQ35 и другие моторы', 
      price: 'от 150 000 ₽',
      href: '/swaps',
      icon: '⚡'
    },
    { 
      name: 'Боди-лифт', 
      desc: 'Поднятие кузова для установки больших колёс и улучшения геометрии', 
      price: 'от 15 000 ₽',
      href: '/services#bodylift',
      icon: '⬆️'
    },
    { 
      name: 'Усиление кузова', 
      desc: 'Усиление лонжеронов, порогов и силовых элементов', 
      price: 'от 25 000 ₽',
      href: '/services#reinforcement',
      icon: '🔧'
    },
    { 
      name: 'Установка защиты', 
      desc: 'Защита картера, раздатки, мостов и порогов', 
      price: 'от 8 000 ₽',
      href: '/services#protection',
      icon: '🛡️'
    },
    { 
      name: 'Установка багажников', 
      desc: 'Крышные и навесные багажники для перевозки грузов', 
      price: 'от 10 000 ₽',
      href: '/services#racks',
      icon: '🧳'
    },
    { 
      name: 'Диагностика', 
      desc: 'Компьютерная диагностика двигателя и электроники', 
      price: 'от 2 000 ₽',
      href: '/services#diagnostics',
      icon: '🔍'
    },
    { 
      name: 'Ремонт внедорожников', 
      desc: 'Ремонт ходовой, трансмиссии и подвески', 
      price: 'от 5 000 ₽',
      href: '/services#repair',
      icon: '🔩'
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
        <div className="text-center mb-16">
          <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">УСЛУГИ</span>
          <h1 className="text-[clamp(32px,4vw,48px)] font-bold mt-2 text-black">
            Наши услуги
          </h1>
          <p className="text-gray-500 font-light max-w-2xl mx-auto mt-4 text-lg">
            Профессиональный тюнинг, свапы двигателей и ремонт внедорожников
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map((service) => (
            <Link
              key={service.name}
              href={service.href}
              className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-gray-400 transition hover:shadow-lg"
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-semibold text-black group-hover:text-gray-600 transition">
                {service.name}
              </h3>
              <p className="text-gray-400 text-sm font-light mt-2 leading-relaxed">
                {service.desc}
              </p>
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-600">{service.price}</span>
                <span className="text-sm text-gray-400 group-hover:text-black transition">
                  Подробнее →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/contacts"
            className="inline-block px-10 py-4 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition"
          >
            Записаться на консультацию
          </Link>
        </div>
      </div>
    </div>
  );
}