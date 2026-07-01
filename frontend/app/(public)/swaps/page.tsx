export default function SwapsPage() {
  const swaps = [
    { name: '3UZ-FE', spec: 'V8 4.3 л', desc: 'Легендарный японский V8. Ставим на Nissan Patrol, Toyota Land Cruiser, коммерческий транспорт.', tags: ['Toyota', 'Lexus'] },
    { name: '5VZ-FE', spec: 'V6 3.4 л', desc: '«Вечный» мотор для Toyota Hilux, Land Cruiser Prado, 4Runner.', tags: ['Toyota', 'Hilux'] },
    { name: 'VQ35DE', spec: 'V6 3.5 л', desc: 'Мощный современный мотор от Nissan. Ставим на Patrol, Pathfinder, коммерческий транспорт.', tags: ['Nissan', 'Infiniti'] },
  ];

  return (
    <div className="container-custom py-32">
      <h1 className="text-4xl font-light">Свапы двигателей</h1>
      <p className="text-white/40 font-light mt-4 max-w-2xl">Устанавливаем моторы «под ключ» с полной интеграцией электроники.</p>
      <div className="mt-12 space-y-6">
        {swaps.map((s) => (
          <div key={s.name} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition">
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="text-2xl font-light text-white">{s.name}</h3>
              <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/50">{s.spec}</span>
            </div>
            <p className="text-white/30 text-sm mt-3 max-w-2xl">{s.desc}</p>
            <div className="flex gap-2 mt-4">{s.tags.map((t) => <span key={t} className="text-xs text-white/30 border border-white/10 px-3 py-1 rounded-full">{t}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}