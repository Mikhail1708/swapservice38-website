import { Factory, ShieldCheck, Wrench, Headphones } from 'lucide-react';

const FEATURES = [
  {
    icon: Factory,
    title: 'Собственное производство',
    text: 'Изготавливаем детали сами — контролируем качество на каждом этапе.',
  },
  {
    icon: ShieldCheck,
    title: 'Надёжность',
    text: 'Используем только проверенные материалы и современные технологии.',
  },
  {
    icon: Wrench,
    title: 'Опыт',
    text: 'Более 10 лет в сфере тюнинга и обслуживания внедорожников.',
  },
  {
    icon: Headphones,
    title: 'Поддержка',
    text: 'Поможем с подбором запчастей и ответим на любые вопросы.',
  },
];

export function FeatureStrip() {
  return (
    <section className="bg-surface text-surface-foreground">
      <div className="container-custom grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex flex-col gap-3">
            <f.icon className="h-6 w-6 text-surface-foreground" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em]">
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed text-surface-muted">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}