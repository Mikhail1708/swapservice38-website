// frontend/components/why-us.tsx
import { Award, ShieldCheck, Clock, Wrench, HeartHandshake } from 'lucide-react';

const REASONS = [
  { 
    icon: ShieldCheck, 
    title: 'Гарантия на всё', 
    text: 'Даём гарантию на все виды работ и установленные запчасти.' 
  },
  { 
    icon: Award, 
    title: 'Проверено на себе', 
    text: 'Каждое наше решение сначала тестируется на собственных автомобилях.' 
  },
  { 
    icon: Wrench, 
    title: 'Мастерство и опыт', 
    text: 'За нашими плечами — годы реальной работы с автомобилями, от классики до современных внедорожников. Доверяйте профессионалам.' 
  },
  { 
    icon: Clock, 
    title: 'Всегда на связи', 
    text: 'Мы работаем без выходных. Отвечаем на звонки и сообщения 7 дней в неделю, 24 часа в сутки.' 
  },
  { 
    icon: HeartHandshake, 
    title: 'Честный подход', 
    text: 'Никаких скрытых платежей. Мы всегда честно объясняем, что нужно сделать, и почему именно так.' 
  },
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