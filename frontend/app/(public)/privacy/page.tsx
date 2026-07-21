// frontend/app/(public)/privacy/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ChevronRight, 
  Shield, 
  FileText, 
  Users, 
  Database, 
  Lock, 
  Eye, 
  Cookie,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShoppingCart,
  UserCheck,
  MessageSquare,
  CreditCard
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — SWAP SERVICE 38',
  description: 'Политика конфиденциальности и обработки персональных данных SWAP SERVICE 38. Честно и прозрачно о том, какие данные мы собираем и зачем.',
  openGraph: {
    title: 'Политика конфиденциальности — SWAP SERVICE 38',
    description: 'Политика конфиденциальности и обработки персональных данных',
    url: 'https://swapservice38.ru/privacy',
    siteName: 'SWAP SERVICE 38',
    locale: 'ru_RU',
    type: 'website',
  },
  alternates: {
    canonical: 'https://swapservice38.ru/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Политика конфиденциальности</span>
        </div>

        {/* Заголовок */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-foreground" />
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Конфиденциальность
            </span>
          </div>
          <h1 className="heading-display text-[clamp(32px,4vw,48px)] text-foreground">
            Политика конфиденциальности
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            Мы ценим ваше доверие и честно рассказываем, какие данные собираем, 
            зачем они нужны и как мы их защищаем.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Последнее обновление: {new Date().toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>

        {/* Главное уведомление */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-10">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium">
                Используя наш сайт, вы даёте согласие на обработку персональных данных 
                в соответствии с Федеральным законом от 27.07.2006 N 152-ФЗ 
                «О персональных данных».
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Если вы не согласны с условиями Политики, пожалуйста, не используйте наш сайт.
              </p>
            </div>
          </div>
        </div>

        {/* Оглавление */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-10">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Содержание
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              { href: '#what', label: '1. Какие данные мы собираем' },
              { href: '#why', label: '2. Зачем мы их собираем' },
              { href: '#how', label: '3. Как мы их используем' },
              { href: '#with', label: '4. Кому мы их передаём' },
              { href: '#protect', label: '5. Как мы защищаем данные' },
              { href: '#rights', label: '6. Ваши права' },
              { href: '#cookies', label: '7. Файлы cookie' },
              { href: '#contacts', label: '8. Контакты' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition py-1"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Контент */}
        <div className="space-y-6 text-muted-foreground">

          {/* 1. Какие данные мы собираем */}
          <section id="what" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">1.</span>
              Какие данные мы собираем
            </h2>
            
            <div className="space-y-4">
              <p className="text-sm">
                Мы собираем только те данные, которые нужны для работы сайта и обслуживания клиентов:
              </p>

              {/* Регистрация */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">При регистрации</h3>
                </div>
                <ul className="space-y-1.5 text-sm pl-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Email</strong> — для входа и получения уведомлений</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Имя и фамилия</strong> — для персонализации общения</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Пароль</strong> — в зашифрованном виде для защиты аккаунта</span>
                  </li>
                </ul>
              </div>

              {/* Заказы */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">При оформлении заказа</h3>
                </div>
                <ul className="space-y-1.5 text-sm pl-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Телефон</strong> — для связи по заказу</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Email</strong> — для отправки подтверждения</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Адрес доставки</strong> — для отправки заказа</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Список товаров</strong> — для формирования заказа</span>
                  </li>
                </ul>
              </div>

              {/* Автоматические данные */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Автоматически</h3>
                </div>
                <ul className="space-y-1.5 text-sm pl-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">IP-адрес</strong> — для защиты от мошенничества</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Данные cookie</strong> — для работы корзины и авторизации</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Тип браузера</strong> — для корректного отображения сайта</span>
                  </li>
                </ul>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-3 mt-2">
                <p className="text-xs text-muted-foreground/70">
                  <strong className="text-foreground">Важно:</strong> Мы <span className="text-foreground font-medium">НЕ собираем</span> данные паспорта, VIN-номера, госномер, пробег, дату рождения и другую информацию, которая не нужна для работы сайта.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Зачем мы их собираем */}
          <section id="why" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">2.</span>
              Зачем мы их собираем
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                <div>
                  <span className="text-foreground font-medium">Для регистрации</span>
                  <span className="text-muted-foreground"> — чтобы вы могли создать аккаунт и пользоваться всеми функциями сайта.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                <div>
                  <span className="text-foreground font-medium">Для оформления заказов</span>
                  <span className="text-muted-foreground"> — чтобы принимать оплату, собирать и отправлять заказы.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                <div>
                  <span className="text-foreground font-medium">Для обратной связи</span>
                  <span className="text-muted-foreground"> — чтобы отвечать на вопросы, уточнять детали заказов.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                <div>
                  <span className="text-foreground font-medium">Для улучшения сервиса</span>
                  <span className="text-muted-foreground"> — анализируем, какие товары популярны, что можно улучшить.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                <div>
                  <span className="text-foreground font-medium">Для безопасности</span>
                  <span className="text-muted-foreground"> — защищаем аккаунты от несанкционированного доступа.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Как мы их используем */}
          <section id="how" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">3.</span>
              Как мы их используем
            </h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 text-foreground" />
                    <span className="text-foreground font-medium text-sm">Уведомления</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Отправляем подтверждения заказов, статусы, напоминания.</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-foreground" />
                    <span className="text-foreground font-medium text-sm">Оплата</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Передаём данные платежному шлюзу для проведения оплаты.</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-foreground" />
                    <span className="text-foreground font-medium text-sm">Поддержка</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Отвечаем на вопросы, решаем проблемы с заказами.</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-foreground" />
                    <span className="text-foreground font-medium text-sm">Аналитика</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Изучаем поведение пользователей для улучшения сайта.</p>
                </div>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3 mt-2">
                <p className="text-xs text-muted-foreground/70">
                  <strong className="text-foreground">Важно:</strong> Мы <span className="text-foreground font-medium">НЕ продаём</span> ваши данные рекламным агентствам и <span className="text-foreground font-medium">НЕ передаём</span> их третьим лицам без вашего согласия.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Кому мы их передаём */}
          <section id="with" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">4.</span>
              Кому мы их передаём
            </h2>
            <div className="space-y-3 text-sm">
              <p>Мы передаём данные только тем, кто участвует в обработке вашего заказа:</p>
              <ul className="space-y-2 pl-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <div>
                    <span className="text-foreground font-medium">Платёжный шлюз</span>
                    <span className="text-muted-foreground"> (ЮKassa) — для проведения оплаты.</span>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Передаём: сумму, номер заказа, email.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <div>
                    <span className="text-foreground font-medium">Служба доставки</span>
                    <span className="text-muted-foreground"> — для отправки заказа.</span>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Передаём: имя, телефон, адрес доставки.</p>
                  </div>
                </li>
              </ul>
              <div className="bg-muted/50 border border-border rounded-lg p-3 mt-2">
                <p className="text-xs text-muted-foreground/70">
                  <strong className="text-foreground">Важно:</strong> Мы <span className="text-foreground font-medium">НЕ передаём</span> ваши данные неограниченному кругу лиц и <span className="text-foreground font-medium">НЕ публикуем</span> их в открытом доступе.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Как мы защищаем данные */}
          <section id="protect" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">5.</span>
              Как мы защищаем данные
            </h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
                  <Lock className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-foreground font-medium">HTTPS/SSL</span>
                    <p className="text-muted-foreground text-xs">Все данные передаются по защищённому соединению.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
                  <Lock className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-foreground font-medium">Хеширование паролей</span>
                    <p className="text-muted-foreground text-xs">Пароли хранятся в зашифрованном виде.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
                  <Lock className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-foreground font-medium">Ограниченный доступ</span>
                    <p className="text-muted-foreground text-xs">К данным имеют доступ только ответственные сотрудники.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
                  <Lock className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-foreground font-medium">Регулярные обновления</span>
                    <p className="text-muted-foreground text-xs">Обновляем программное обеспечение для защиты от уязвимостей.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Ваши права */}
          <section id="rights" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">6.</span>
              Ваши права
            </h2>
            <div className="space-y-3 text-sm">
              <p>У вас есть право:</p>
              <ul className="space-y-2 pl-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <span>Запросить, какие данные о вас хранятся</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <span>Изменить или дополнить свои данные</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <span>Удалить аккаунт и все связанные данные</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                  <span>Отозвать согласие на обработку данных</span>
                </li>
              </ul>
              <div className="bg-muted rounded-lg p-4 mt-3">
                <p className="text-xs text-muted-foreground/70">
                  Для реализации своих прав напишите нам на{' '}
                  <a 
                    href="mailto:swapservice38@yandex.ru" 
                    className="text-foreground hover:underline font-medium"
                  >
                    swapservice38@yandex.ru
                  </a>
                  {' '}— мы ответим в течение 10 рабочих дней.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Файлы cookie */}
          <section id="cookies" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">7.</span>
              Файлы cookie
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Cookie className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Что это такое?</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Cookie — это небольшие файлы, которые сохраняются в вашем браузере. 
                    Они помогают сайту работать корректно.
                  </p>
                </div>
              </div>
              <p className="text-sm">Мы используем cookie для:</p>
              <ul className="space-y-1.5 pl-4 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Хранения товаров в корзине</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Автоматического входа в аккаунт</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Сбора аналитики (какие страницы посещают)</span>
                </li>
              </ul>
              <div className="bg-muted/50 border border-border rounded-lg p-3 mt-2">
                <p className="text-xs text-muted-foreground/70">
                  Вы можете отключить cookie в настройках браузера. Но тогда сайт может работать некорректно 
                  (например, корзина не сохранит товары).
                </p>
              </div>
            </div>
          </section>

          {/* 8. Контакты */}
          <section id="contacts" className="bg-card border border-border rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">8.</span>
              Контакты
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                Если у вас есть вопросы по обработке данных, свяжитесь с нами:
              </p>
              <div className="bg-muted border border-border rounded-lg p-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Телефон:</span>
                  <a 
                    href="tel:+79148993838" 
                    className="text-foreground hover:underline font-medium"
                  >
                    7 (914) 895-58-88
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <a 
                    href="mailto:swapservice38@yandex.ru" 
                    className="text-foreground hover:underline font-medium"
                  >
                    swapservice38@yandex.ru
                  </a>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Адрес:</span>
                  <span className="text-foreground font-medium">г. Иркутск, ул. Новаторов 36</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Кнопки навигации */}
        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <Link 
            href="/contacts" 
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Связаться с нами
          </Link>
        </div>

        {/* Дата обновления */}
        <div className="mt-8 text-center text-xs text-muted-foreground/40">
          Версия 1.0 от {new Date().toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}
        </div>
      </div>
    </div>
  );
}