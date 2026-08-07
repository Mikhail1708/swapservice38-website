// frontend/components/why-us.tsx
import { Award, BadgeDollarSign, Users, Target, Cpu } from 'lucide-react';

const REASONS = [
  { icon: Award, title: 'Реальный опыт', text: 'Все наши детали и решения проверены на собственных авто.' },
  { icon: BadgeDollarSign, title: 'Честные цены', text: 'Оптимальное соотношение качества и стоимости без переплат.' },
  { icon: Users, title: 'Профессионалы', text: 'Команда специалистов с опытом работы более 10 лет.' },
  { icon: Target, title: 'Индивидуальный подход', text: 'Подбираем решения под ваши задачи и бюджет.' },
  { icon: Cpu, title: 'Современное оборудование', text: 'Используем лучшее оборудование и технологии.' },
];

export function WhyUs() {
  return (
    <section id="why" className="bg-surface py-24 text-surface-foreground">
      <div className="container-custom">
        <div className="mb-12">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-surface-muted">
            Почему мы
          </span>
          <h2 className="heading-display mt-3 text-[clamp(30px,4vw,48px)]">
            Почему выбирают нас
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-surface-border bg-surface-border sm:grid-cols-2 lg:grid-cols-5">
          {REASONS.map((r) => (
            <div key={r.title} className="flex flex-col gap-3 bg-surface-card p-7">
              <r.icon className="h-6 w-6 text-surface-foreground" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold uppercase tracking-[0.06em]">
                {r.title}
              </h3>
              <p className="text-sm leading-relaxed text-surface-muted">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}