import Link from 'next/link';

export default function CatalogPage() {
  return (
    <div className="container-custom py-32">
      <h1 className="text-4xl font-light">Каталог продукции</h1>
      <p className="text-white/40 font-light mt-4 max-w-2xl">Всё спроектировано нашими инженерами и протестировано на реальных автомобилях.</p>
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        {['Свап-киты', 'Дроп-киты', 'Защиты', 'Усиление', 'Багажники', 'Фланцы'].map((cat) => (
          <div key={cat} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-white/20 transition">
            <div className="text-4xl mb-4 opacity-30">🔧</div>
            <h3 className="text-xl font-light text-white">{cat}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}