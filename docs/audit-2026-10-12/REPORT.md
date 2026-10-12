# Локальный аудит SWAPSERVICE38 — 12 октября 2026

## Вердикт: NEEDS REVIEW

Подтверждённые ошибки в проверенных сценариях исправлены. TypeScript, production-сборки и доступные автоматические тесты проходят. Для безусловного разрешения production-деплоя остаются проверка на настоящем iPhone/Safari и Android/Chrome, рассмотрение владельцем большого совокупного diff и сверка фактической production-ревизии. Production не запрашивался и не изменялся; локальный HEAD не выдаётся за установленную production-версию.

Работа проводилась исключительно в SITE, ветка `master`. Коммитов, push, merge, rebase, деплоя и миграций не выполнялось. CRM не изменялся.

## Границы проверки

Изучены README, ARCHITECTURE, SECURITY, рабочее дерево, staged diff, изменённые публичные компоненты, административный layout, Image shim, маршрутизация, API-контракты для browser fixtures и конфигурация тестов. В репозитории не найден отдельный AGENTS.md; применены инструкции пользователя.

Начальные мобильные изменения и пользовательские изменения Header, Footer, AdminLayout, globals.css и Hero сохранены. Значительная часть итогового diff этих файлов существовала до расширенного аудита. Это не переписывание проекта аудитом.

Backend, Prisma schema/migrations, конфигурация серверов, runtime-зависимости и секреты не изменялись. Backend проверялся компиляцией и существующим Jest suite. Платёжные провайдеры, Redis, Prisma и SMTP в этом suite замоканы. Реальных платежей, заказов или писем не создавалось.

## Исправленные дефекты

| Место | Причина и исправление | Проверка |
|---|---|---|
| `frontend/src/app/(public)/cart/page.tsx` | Непустая корзина при 320 px расширяла документ до 396 px: неявная минимальная ширина grid и несжимаемая строка товара. Добавлена явная колонка `minmax(0,1fr)`, `min-w-0`, мобильная раскладка товара, перенос действий, адаптивные изображение и padding. Горизонтальный overflow не скрывается маской. | Chrome: непустая корзина на 320,360,375,390,412,430,440,768,1024,1440 px; после исправления документ 320 px при viewport 320 px. Checkout contract tests проходят. |
| `components/admin/layout/AdminLayout.tsx` | Manager мог смонтировать дочернюю страницу пользователей до редиректа. Добавлена синхронная проверка перед рендером children. Закрытый мобильный sidebar теперь скрыт и для клавиатуры. Общий transition анимировал десктопный отступ при переходе на телефон, временно расширяя документ; оставлена анимация margin только на десктопе. | Новый contract test ролей; Chrome: redirect, меню/Escape и ширины 320,768,1024,1440. Серверный RBAC не заменяется frontend-проверкой. |
| `components/hero.tsx` | Все фоны могли загружаться сразу, а fallback не покрывал сбой WebP старого фото. Теперь монтируются актуальное фото, предыдущий декодированный фон на время перехода и следующее фото после загрузки текущего; ограниченный fallback на оригинал той же темы. Сохранён единственный 12-секундный таймер, ручное управление сбрасывает отсчёт. Возвращены боковые стрелки и правые вертикальные индикаторы на ПК; мобильное управление остаётся в потоке. Возвращена исходная CTA-ссылка `#footer`. | Contract tests таймера; Chrome: предыдущий/следующий, не более трёх mounted images, имитация сетевого отказа WebP, production bundle smoke. |
| `lib/hero-rotation.ts` | В промежуточной реализации исчез двадцатый слот, список доступных файлов смещал расписание, индекс недели до даты старта обрезался, рекурсивный расчёт циклов накапливал стек. Восстановлен слот tunning1 с fallback, расписание сохраняет длины коллекций, индекс непрерывный, переход UTC-недели точный; расчёт циклов итеративный. | Границы понедельника, переход года, эквивалентные timezone timestamps, отрицательный индекс до старта, независимые циклы, отсутствие файла. |
| `components/site-header.tsx` | В текущем рабочем варианте обработчик снова был привязан к window. Возвращён фактический document.scrollingElement; интерактивные дочерние элементы исключены. | Contract + Chrome: свободная область, отсутствие навигации, мобильное меню/Escape. |
| `app/(public)/catalog/page.tsx` | Случайный литерал `тзь` попадал в карточку товара. Удалён. | Рендер карточек и браузерная матрица. |
| `app/(public)/offer/page.tsx` | Телефоны/почта в InfoRow были обычным текстом. Добавлены ссылки на существующие shared контакты без изменения юридического текста и реквизитов. | Legal documents tests. |
| Frontend tests | Устаревший mock submit не содержал stopPropagation; regex футера требовал li без attributes; старые проверки карточек ожидали удалённые ранее контактные CTA и старые контакты. Проверки обновлены согласно текущему поведению: карточка ведёт на товар, на странице товара доступны контакты, online-покупка не предлагается для on-order. | Полный frontend suite: 86/86. |

Ранее в этой же локальной работе исправлены navigation swaps/services и lightbox: portal, contain без увеличения маленьких фото, safe-area/dvh, кнопки 48 px, загрузка/ошибка, свайпы, Escape/стрелки, блокировка страницы, focus trap и возврат фокуса/позиции. Они повторно проверены и сохранены.

## Hero: фото и ротация

- 20 слотов: swap 5, tuning 5, производство 2, сервис 4, продажа 4.
- Фактически предоставлены 19 оригиналов. `tunning1.png` отсутствует; предусмотренный путь — `frontend/public/images/hero/tunning1.png`. Его неделя показывает `hero-suv2.png`.
- Остальные новые фотографии остаются на фактических путях `frontend/public/images/`. В рабочем дереве используется имя `tunning2.png`; аудит его не переименовывал.
- Все пять `hero-suv*.png` сохранены без изменения и участвуют в циклах.
- Начало расписания — понедельник 2026-10-12 00:00 UTC. Сохранён введённый в рабочем дереве детерминированный порядок внутри независимых циклов: в первом цикле старое фото первое, затем каждая фотография используется один раз; на стыке циклов непосредственного повтора нет. Math.random/localStorage/cron/API не используются.
- Открытая вкладка обновляет неделю по таймеру границы понедельника и при visibilitychange. SSR отсутствует: React createRoot/Vite, гидратация не применяется.
- 56 WebP-копий, суммарно 7 805 318 байт, вместо загрузки больших PNG в обычном сценарии. Размеры 640,1280 и исходная ширина (до 2560, без upscale); все реальные исходники меньше 1920 px.
- `srcSet`, `sizes`, `object-fit: cover`, индивидуальные mobile/desktop позиции. Центры кадрирования подобраны после просмотра контактного листа. Сохранены тёмные градиенты; тексты и тематический порядок не изменены.
- На очень узких телефонах индикаторы переходят на отдельную строку: все пять кнопок сохраняют ширину не менее 44 px. Иначе семь элементов по 44 px физически не помещаются в контейнер 320 px с полями.
- При reduced motion автоматическая смена отключается, ручная работает без анимации.
- Генератор: `frontend/scripts/build-hero-images.py`; Pillow 12.2.0 нужен только разработчику при обновлении изображений. На runtime/build сайта Python не нужен. После добавления исходника нужно повторно сгенерировать manifest и WebP. Никаких новых production ENV/cron/worker/migrations.

## Результаты

| Проверка | Статус | Результат |
|---|---|---|
| TypeScript | PASS | Frontend и backend; также выполняется production build |
| ESLint | NOT RUN | Нет установленного/configured frontend ESLint или lint script; новая конфигурация для всего проекта не навязывалась |
| Frontend contract/unit | PASS | 86 тестов, 0 failures |
| Backend Jest | PASS | 74 suites, 837 тестов, 0 failures |
| Интеграционные тесты | PASS, ограниченный | В Jest прошли mock-payment-flow, products, password-reset-security; это не live PostgreSQL/CRM/провайдер |
| Frontend production build | PASS | Vite: 1341 modules; JS 666.69 kB / gzip 164.95 kB, предупреждение >500 kB |
| Backend production build | PASS | tsc, вывод в изолированный временный каталог |
| Prisma validate | PASS | Схема валидна; migrations не менялись и не применялись |
| Browser viewport matrix | PASS | 150 случаев: 15 маршрутов × 10 ширин, 0 runtime errors, 0 document overflow |
| Browser interactions / E2E smoke | PASS | 11 групп сценариев; повторено на локальном production preview, 0 failures/errors |
| Мобильная адаптивность | PASS в Chrome-эмуляции | Дополнительно непустая корзина на 10 ширинах; admin на 4; gallery landscape |
| Безопасность изменений | PASS в проверенном объёме | Frontend gate, существующие backend security/RBAC tests, отсутствие изменений секретов/БД; не полноценный pentest |
| Регрессии | PASS в доступных suites | Invoice, YooKassa, checkout, consent, CRM delivery и email проверены существующими mocks/tests |
| git diff --check | PASS | Нет whitespace errors |

Browser matrix: `/`, `/catalog`, `/catalog/134`, `/services`, `/services/1`, `/swaps`, `/swaps/fixture`, `/contacts`, `/cart`, `/login`, `/register`, `/privacy`, `/offer`, `/profile`, `/profile/orders`.

Ширины: 320,360,375,390,412,430,440,768,1024,1440. Скриншоты Hero: 375×812,390×844,768×1024,1440×900,1920×1080. Все API в браузере перехвачены fixtures; внешние запросы заблокированы. Пустая корзина проверена в общей матрице, непустая — отдельным regression test. Свайп проверен синтетическими TouchEvent в настоящем headless Chrome, не физическим жестом на телефоне.

Доказательства: `viewport-results.json`, `production-interaction-results.json`, `cart-metrics.json`, изображения рядом с отчётом. Браузер: локальный Chrome, Playwright 1.64.0. Встроенный browser plugin был недоступен из-за trusted-path ошибки; использован изолированный локальный Playwright.

## Файлы

Код, исправленный/добавленный в расширенном аудите:

- `frontend/src/components/hero.tsx` — загрузка, fallback, управление и таймеры.
- `frontend/src/lib/hero-rotation.ts` — календарь и коллекции.
- `frontend/src/lib/hero-image-assets.json` — manifest 19 доступных оригиналов.
- `frontend/scripts/build-hero-images.py` — воспроизводимая генерация WebP.
- `frontend/public/images/hero/optimized/*.webp` — 56 производных изображений, все пути перечислены в manifest.
- `frontend/src/components/site-header.tsx` — scroll root; пользовательская новая шапка сохранена.
- `frontend/src/components/admin/layout/AdminLayout.tsx` — синхронный access gate, скрытие sidebar, адаптивная анимация margin.
- `frontend/src/app/(public)/cart/page.tsx` — устранение переполнения заполненной корзины.
- `frontend/src/app/(public)/catalog/page.tsx` — удаление случайного текста.
- `frontend/src/app/(public)/offer/page.tsx` — контактные ссылки.
- `frontend/tests/contracts/{admin-layout-access,hero-rotation,mobile-header-hero}.test.cjs` — новые/расширенные регрессии.
- `frontend/tests/contracts/{consent-flow,product-availability,product-rendering,service-content}.test.cjs` — исправление устаревших fixtures/assertions.
- `frontend/tests/browser/public-ux.cjs` — локальные безопасные browser checks с перехватом API.
- `docs/audit-2026-10-12/` — отчёт и доказательства.

Ранее выполненные мобильные правки и пользовательские изменения также входят в проверенный рабочий diff: `frontend/src/app/(public)/swaps/page.tsx`, `swaps/[id]/page.tsx`, `frontend/src/app/globals.css`, `frontend/src/components/site-footer.tsx`, `frontend/tests/contracts/mobile-gallery.test.cjs`. Новые оригиналы swap/service/dorozh/tunning/proizvodstvo предоставлены пользователем; аудит их не удалял и не изменял.

## Воспроизведение

Frontend: `node --test tests/contracts/*.test.cjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm run build` из frontend. Backend: `npm test -- --silent`, `npm run build`, `node node_modules/prisma/build/index.js validate` из backend. В аудите сборки выводились во временные каталоги, tracked dist не изменён.

Для browser test установить Playwright 1.64.0 отдельно, запустить локальный Vite или preview, задать `PLAYWRIGHT_MODULE` (если вне обычного node_modules), `CHROME_PATH` к локальному Chrome и при необходимости `UX_BASE_URL`. Скрипт запрещает нелокальный base URL. Запуск: `node frontend/tests/browser/public-ux.cjs`. `UX_INTERACTIONS_ONLY=1` запускает только interaction checks; `UX_ARTIFACTS` задаёт каталог результатов. Это параметры теста, не production ENV.

## Перед ручным коммитом/деплоем

Пока не рекомендован безусловный production deploy. Нужно:

1. Владельцу просмотреть весь накопленный diff, включая его собственные большие изменения Header/Footer/AdminLayout/CSS и юридические контактные ссылки.
2. Проверить настоящий Safari/iPhone и Chrome/Android: динамические панели, safe-area, scroll lock, возврат фокуса, свайпы и поворот устройства.
3. Сверить реально установленную production-ревизию и штатный процесс сборки; включить новые оригиналы, все WebP и manifest вместе. Не публиковать только TS-файлы без assets.
4. По возможности выполнить smoke с локальным/изолированным backend и тестовой БД. Реальная интеграция CRM/YooKassa/SMTP и production DB этим аудитом не подтверждена.

Не блокирующие ограничения: отсутствует tunning1 (fallback работает); исходники не обеспечивают настоящее разрешение 2560/Retina; большой JS bundle; нет настроенного ESLint. Визуального тестирования Safari и настоящих устройств не было. Никакие изменения production автоматически не требуются; новые миграции и runtime ENV не нужны.
