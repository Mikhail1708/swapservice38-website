// frontend/app/(public)/privacy/page.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <div className="prose prose-gray max-w-none">
          <h1 className="text-4xl font-bold text-black mb-6">Политика конфиденциальности</h1>
          <p className="text-gray-400 text-sm mb-8">
            Последнее обновление: {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div className="space-y-6 text-gray-600 font-light leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">1. Общие положения</h2>
              <p>
                Настоящая Политика конфиденциальности (далее — «Политика») регулирует порядок сбора, 
                обработки, хранения и защиты персональных данных пользователей сайта SWAP SERVICE 38 
                (далее — «Сайт»), расположенного по адресу <strong>swapservice38.ru</strong>.
              </p>
              <p>
                Используя Сайт, вы даете согласие на обработку ваших персональных данных в соответствии 
                с настоящей Политикой. Если вы не согласны с условиями Политики, пожалуйста, не используйте Сайт.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">2. Какие данные мы собираем</h2>
              <p>Мы можем собирать следующие персональные данные:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Контактная информация:</strong> имя, фамилия, номер телефона, адрес электронной почты, адрес доставки.</li>
                <li><strong>Данные о заказах:</strong> информация о приобретенных товарах и услугах, способах оплаты и доставки.</li>
                <li><strong>Технические данные:</strong> IP-адрес, тип браузера, операционная система, данные о посещениях и действиях на Сайте.</li>
                <li><strong>Данные, предоставленные добровольно:</strong> комментарии, отзывы, сообщения через формы обратной связи.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">3. Как мы используем ваши данные</h2>
              <p>Мы используем ваши персональные данные для следующих целей:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Обработка заказов:</strong> оформление, оплата и доставка товаров и услуг.</li>
                <li><strong>Связь с вами:</strong> уведомления о статусе заказа, ответы на вопросы, консультации.</li>
                <li><strong>Улучшение сервиса:</strong> анализ поведения пользователей для улучшения работы Сайта.</li>
                <li><strong>Маркетинговые цели:</strong> информирование о новых товарах, акциях и специальных предложениях (только с вашего согласия).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">4. Как мы защищаем ваши данные</h2>
              <p>
                Мы принимаем все необходимые организационные и технические меры для защиты ваших персональных 
                данных от несанкционированного доступа, изменения, раскрытия или уничтожения:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Использование защищенного соединения (HTTPS/SSL).</li>
                <li>Хранение паролей в зашифрованном виде (хеширование).</li>
                <li>Ограничение доступа к персональным данным сотрудников.</li>
                <li>Регулярное обновление программного обеспечения.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">5. Передача данных третьим лицам</h2>
              <p>
                Мы не передаем ваши персональные данные третьим лицам, за исключением случаев, 
                предусмотренных законодательством Российской Федерации, или когда это необходимо 
                для выполнения заказа (например, транспортным компаниям для доставки).
              </p>
              <p className="mt-2">
                Мы также можем использовать сторонние сервисы для аналитики (например, Яндекс.Метрика), 
                которые собирают обезличенные данные о посещениях Сайта.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">6. Файлы cookie (куки)</h2>
              <p>
                Сайт использует файлы cookie для обеспечения корректной работы, улучшения пользовательского 
                опыта и сбора аналитической информации. Вы можете отключить использование cookie в настройках 
                вашего браузера, однако это может повлиять на функциональность некоторых разделов Сайта.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">7. Ваши права</h2>
              <p>Вы имеете право:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Запросить информацию о хранящихся у нас персональных данных.</li>
                <li>Требовать исправления, удаления или блокировки ваших данных.</li>
                <li>Отозвать согласие на обработку данных в любое время.</li>
              </ul>
              <p className="mt-2">
                Для реализации этих прав свяжитесь с нами по электронной почте: <strong>swapservice38@yandex.ru</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">8. Изменения в Политике</h2>
              <p>
                Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. 
                Актуальная версия всегда доступна на этой странице. Рекомендуем периодически проверять 
                страницу для ознакомления с обновлениями.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-black mt-8 mb-4">9. Контакты</h2>
              <p>
                По всем вопросам, связанным с обработкой персональных данных, вы можете связаться с нами:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mt-4">
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Телефон:</span> <a href="tel:+79939411093" className="text-black hover:underline">+7 (993) 941-10-93</a></p>
                  <p><span className="font-medium">Email:</span> <a href="mailto:swapservice38@yandex.ru" className="text-black hover:underline">swapservice38@yandex.ru</a></p>
                  <p><span className="font-medium">Адрес:</span> г. Иркутск, ул. Новаторов 36</p>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-gray-200 pt-8 mt-12 flex flex-wrap gap-4">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              На главную
            </Link>
            <Link 
              href="/contacts" 
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}