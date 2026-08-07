// frontend/app/(public)/offer/page.tsx
import { Image, Link } from '@/lib/next-shims';
import { ArrowLeft, ChevronRight, FileText, Shield, CheckCircle } from 'lucide-react';


export default function OfferPage() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Договор оферты</span>
        </div>

        {/* Заголовок */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-foreground" />
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Документ
            </span>
          </div>
          <h1 className="heading-display text-[clamp(32px,4vw,44px)] text-foreground">
            Публичный договор оферты
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            Настоящий документ является официальной офертой интернет-магазина SWAP SERVICE 38
            и определяет условия заказа, оплаты, доставки и возврата товаров.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Версия 1.0 от {new Date().toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>

        {/* Содержание */}
        <div className="space-y-8 text-muted-foreground">
          {/* 1. Общие положения */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">1.</span>
              Общие положения
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                1.1. Настоящий документ является официальной публичной офертой 
                интернет-магазина <strong className="text-foreground">SWAP SERVICE 38 </strong> 
                 (далее — «Продавец») и определяет условия продажи товаров дистанционным способом.
              </p>
              <p>
                1.2. Размещая заказ на сайте <Link href="/" className="text-foreground hover:underline">swapservice38.ru</Link>, 
                Покупатель принимает условия настоящей оферты в полном объёме.
              </p>
              <p>
                1.3. Продавец оставляет за собой право вносить изменения в условия оферты 
                без предварительного уведомления Покупателя. Актуальная версия всегда доступна 
                на сайте.
              </p>
            </div>
          </section>

          {/* 2. Товар и цена */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">2.</span>
              Товар и цена
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                2.1. Товар представлен на сайте через каталог с описанием, фотографиями и ценой.
              </p>
              <p>
                2.2. Цена товара указывается в российских рублях и включает все налоги.
              </p>
              <p>
                2.3. Продавец оставляет за собой право изменять цены на товары без 
                предварительного уведомления. Цена заказа фиксируется в момент оформления.
              </p>
              <p>
                2.4. Стоимость доставки рассчитывается отдельно и указывается при оформлении заказа.
              </p>
            </div>
          </section>

          {/* 3. Заказ и оплата */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">3.</span>
              Заказ и оплата
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                3.1. Заказ оформляется через корзину на сайте. Покупатель указывает 
                контактные данные и адрес доставки.
              </p>
              <p>
                3.2. Оплата осуществляется через платёжную систему ЮKassa банковской картой 
                или другими доступными способами.
              </p>
              <p>
                3.3. Заказ считается оплаченным в момент поступления средств на счёт Продавца.
              </p>
              <p>
                3.4. После оплаты Покупатель получает подтверждение заказа на указанный email.
              </p>
            </div>
          </section>

          {/* 4. Доставка */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">4.</span>
              Доставка
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                4.1. Доставка осуществляется по указанному Покупателем адресу.
              </p>
              <p>
                4.2. Сроки доставки согласовываются индивидуально с Покупателем.
              </p>
              <p>
                4.3. Возможен самовывоз из сервисного центра по адресу: 
                г. Иркутск, ул. Новаторов 36.
              </p>
              <p>
                4.4. Стоимость доставки рассчитывается в зависимости от региона и способа доставки.
              </p>
            </div>
          </section>

          {/* 5. Возврат товара */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">5.</span>
              Возврат товара
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                5.1. Покупатель имеет право вернуть товар надлежащего качества в течение 14 дней 
                с момента получения, если он не был в употреблении и сохранены его потребительские свойства.
              </p>
              <p>
                5.2. Возврат товара ненадлежащего качества осуществляется в соответствии 
                с Законом «О защите прав потребителей».
              </p>
              <p>
                5.3. Для возврата товара необходимо связаться с нами по телефону 
                <a href="tel:+7 (983) 446-08-88" className="text-foreground hover:underline ml-1">+7 (983) 446-08-88</a>.
              </p>
            </div>
          </section>

          {/* 6. Реквизиты */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">6.</span>
              Реквизиты
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Индивидуальный предприниматель</span>
                <span className="text-foreground font-medium">ИП Иванов Иван Иванович</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">ИНН</span>
                <span className="text-foreground font-medium">381212345678</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">ОГРНИП</span>
                <span className="text-foreground font-medium">321380000123456</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Расчётный счёт</span>
                <span className="text-foreground font-medium">40802810123456789012</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Банк</span>
                <span className="text-foreground font-medium">Байкальский Банк ПАО Сбербанк</span>
              </div>
            </div>
          </section>

          {/* 7. Контакты */}
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-normal">7.</span>
              Контакты
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-24">Телефон:</span>
                <a href="tel:+79148993838" className="text-foreground hover:underline font-medium">
                  +7 (983) 446-08-88
                </a>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-24">Email:</span>
                <a href="mailto:swapservice38@yandex.ru" className="text-foreground hover:underline font-medium">
                  swapservice38@yandex.ru
                </a>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-24">Адрес:</span>
                <span className="text-foreground font-medium">г. Иркутск, ул. Новаторов 36</span>
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
            href="/cart" 
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Вернуться в корзину
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