// app/(public)/swaps/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  tags: string[];
  readTime: number;
  likesCount: number;
  views: number;
}

export default function SwapsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/articles?published=true&type=swap');
        if (!response.ok) throw new Error('Ошибка загрузки статей');
        const data = await response.json();
        console.log('📥 Загружено статей для свапов:', data.items?.length || 0);
        setArticles(data.items || []);
      } catch (err) {
        console.error('❌ Ошибка загрузки статей:', err);
        setError('Не удалось загрузить статьи');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
        {/* Заголовок */}
        <div className="text-center mb-16">
          <span className="text-[11px] tracking-[0.25em] text-gray-400 uppercase font-medium">СВАПЫ ДВИГАТЕЛЕЙ</span>
          <h1 className="text-[clamp(32px,4vw,48px)] font-bold mt-2 text-black">
            Свап двигателей на внедорожники<br />
            <span className="text-[clamp(32px,4vw,48px)] font-bold mt-2 text-black">и коммерческий транспорт</span>
          </h1>
          <p className="text-gray-500 font-light max-w-3xl mx-auto mt-4 text-lg">
            Устанавливаем мощные и надёжные моторы «под ключ» с полной интеграцией электроники.
            Собственные свап-киты — идеальная посадка без «колхоза».
          </p>
        </div>

        {/* Что такое свап */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 md:p-12 mb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-black mb-4 text-center">Что такое свап двигателя?</h2>
            <p className="text-gray-600 font-light leading-relaxed text-center">
              Свап двигателя — это не просто «переставить мотор». Это комплекс инженерных задач:
              совместимость электроники, переделка креплений, адаптация коробок передач, охлаждения,
              выпуска, топливной системы. Мы решаем эти задачи профессионально, потому что делаем это каждый день.
            </p>
          </div>
        </div>

        {/* Зачем нужен свап */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-black">Мощность</h3>
            <p className="text-gray-400 text-sm font-light mt-2">Увеличение мощности и крутящего момента без покупки нового автомобиля</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition">
            <div className="text-3xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold text-black">Надёжность</h3>
            <p className="text-gray-400 text-sm font-light mt-2">Установка проверенных моторов с большим ресурсом и доступными запчастями</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-lg font-semibold text-black">Экономия</h3>
            <p className="text-gray-400 text-sm font-light mt-2">Модернизация автомобиля дешевле покупки новой машины с аналогичными характеристиками</p>
          </div>
        </div>

        {/* Какие моторы мы ставим */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-black mb-6 text-center">Какие моторы мы ставим</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: '3UZ-FE', spec: 'V8 4.3 л', desc: 'Легендарный японский V8' },
              { name: '5VZ-FE', spec: 'V6 3.4 л', desc: '«Вечный» мотор Toyota' },
              { name: 'VQ35DE', spec: 'V6 3.5 л', desc: 'Мощный современный V6' },
              { name: 'BMW M57', spec: '3.0d турбо', desc: 'Турбодизель с тягой' },
            ].map((m) => (
              <div key={m.name} className="bg-white border border-gray-200 rounded-2xl p-6 text-center hover:border-gray-400 transition">
                <div className="text-xl font-bold text-black">{m.name}</div>
                <div className="text-xs text-gray-400 mt-1">{m.spec}</div>
                <div className="text-xs text-gray-500 mt-2 font-light">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Статьи */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-black">Наши проекты</h2>
            <span className="text-sm text-gray-400">{articles.length} статей</span>
          </div>

          {error && (
            <div className="text-center py-8 text-gray-500">{error}</div>
          )}

          {articles.length === 0 && !error ? (
            <div className="text-center py-16">
              <p className="text-gray-400">Статей пока нет</p>
              <p className="text-sm text-gray-400 mt-2">Создайте статью в админке → Контент → Статьи, выберите тип "Свапы"</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/swaps/${article.slug || article.id}`}
                  className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-400 transition hover:shadow-lg flex flex-col"
                >
                  <div className="h-48 bg-gray-100 relative overflow-hidden">
                    {article.imageUrl ? (
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                        Нет фото
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1 rounded-full">
                      {article.readTime || 5} мин
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {article.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                      {article.tags?.length > 2 && (
                        <span className="text-[10px] text-gray-400 px-1">+{article.tags.length - 2}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-black group-hover:text-gray-600 transition line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-500 font-light mt-2 line-clamp-2 flex-1">
                      {article.description}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {new Date(article.date).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="text-xs font-medium text-black group-hover:underline">
                        Читать →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center mt-16">
          <h2 className="text-2xl font-bold text-black mb-3">Хотите сделать свап?</h2>
          <p className="text-gray-500 font-light max-w-2xl mx-auto mb-6">
            Приезжайте на консультацию. Рассчитаем бюджет, подберём мотор и разработаем индивидуальный план работ.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contacts" className="px-8 py-3 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition">
              Записаться на консультацию
            </Link>
            <Link href="/catalog" className="px-8 py-3 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition">
              Посмотреть каталог
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}