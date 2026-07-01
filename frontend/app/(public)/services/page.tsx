import Link from 'next/link';

export default function ServicesPage() {
  const services = [
    { name: 'Боди-лифт', desc: 'Поднятие кузова для установки больших колес', price: 'от 15 000 ₽' },
    { name: 'Установка защиты', desc: 'Защита картера, раздатки и мостов', price: 'от 8 000 ₽' },
    { name: 'Усиление кузова', desc: 'Усиление лонжеронов и силовых элементов', price: 'от 25 000 ₽' },
    { name: 'Установка багажников', desc: 'Крышные и навесные багажники', price: 'от 10 000 ₽' },
  ];

  return (
    <div className="container-custom py-32">
      <h1 className="text-4xl font-light">Наши услуги</h1>
      <p className="text-white/40 font-light mt-4 max-w-2xl">Профессиональный тюнинг и установка дополнительного оборудования.</p>
      <div className="grid md:grid-cols-2 gap-6 mt-12">
        {services.map((s) => (
          <div key={s.name} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition">
            <h3 className="text-2xl font-light text-white">{s.name}</h3>
            <p className="text-white/30 text-sm mt-2">{s.desc}</p>
            <div className="flex justify-between items-center mt-6">
              <span className="text-white/60">{s.price}</span>
              <Link href="/contacts" className="text-sm border border-white/10 px-5 py-2 rounded-full text-white/50 hover:bg-white/5 transition">Записаться</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}