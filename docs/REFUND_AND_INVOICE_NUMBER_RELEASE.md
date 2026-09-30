# Durable refund и короткие номера Invoice — локальная доработка 30.09.2026

## Границы работы

Изменён только SITE. CRM, VPS и production DB не изменялись. Commit/push/deploy не выполнялись. Состояние production описано пользователем; по SSH оно не проверялось. GitHub и production пока не синхронизированы: для этого после review необходимы обычные commit/push и согласованный deploy.

## Refund

Причина исходной ошибки: dispatcher вызывал POST /refunds без предварительного чтения платежа. Любое исключение расходовало общий бюджет 8 попыток с коротким backoff. Состояние refundable=false не отличалось от ошибок.

Теперь обработчик сохраняет существующий deterministic OutboxEvent и порядок проверки eligibility под Order FOR UPDATE:

1. Claim pending event через CAS с nextAttemptAt; дальнейшие записи привязаны к lockedAt и attempts именно этого владельца.
2. Проверка paymentId, суммы/валюты intent и PaymentAttempt, причины возврата и отмены. Для pre-handoff остаётся compensation_required, для подтверждённой CRM отмены — refund_required.
3. GET /payments/{id} перед POST. Проверяются ID, сумма, валюта, succeeded и paid=true.
4. Полный refunded_amount завершает локальный intent без нового POST. Существующий refundId сохраняется. Если GET payment не даёт refund identity и локально её нет, ID не выдумывается; refundedAt — время локальной сверки.
5. Частичный возврат или противоречащая сумма требует review: нельзя автоматически вернуть полную сумму ещё раз.
6. Если refundId уже сохранён, проверяется GET /refunds/{refundId}. Pending остаётся в ожидании; succeeded завершает intent; canceled — terminal failure.
7. Если refundable=false, POST не вызывается. Event возвращается в pending, PaymentAttempt остаётся required, lastError содержит REFUND_WAITING_PROVIDER. Эта проверка не расходует бюджет ошибок. Интервал начинается с 5 минут, увеличивается с возрастом intent до 6 часов.
8. Существующий outbox dispatcher автоматически выбирает событие после nextAttemptAt. При refundable=true используется прежний ключ payment-refund:{paymentId} и исходная сумма. Pending response сохраняет refundId сразу для дальнейших GET; succeeded фиксирует refunded/refundId/refundedAt, очищает lastError и завершает event.
9. Transport/timeout/5xx/408/429 сохраняют bounded retry: backoff 30 секунд, 1/2/4/... минуты, максимум 30 минут; существующий REFUND_MAX_ATTEMPTS (по умолчанию 8) ограничивает реальные ошибки. Terminal 4xx/business rejection переводит intent и attempt в failed/refund_failed.
10. При POST 403 повторный GET отличает изменение refundable от terminal refusal. Если ПЕРВЫЙ POST достоверно отклонён и GET подтвердил refundable=false, ожидание может продолжаться неограниченно по времени без повторного расходования бюджета.

Новых worker/cron/ENV/dependencies нет. Должен продолжать работать существующий CRM/outbox dispatcher. Отдельный provider reconciliation для initiating/pending/unknown платежей не переписан. Late succeeded и cancellation writers используют прежний общий workflow.

### Идемпотентность и ручной retry

ЮKassa гарантирует Idempotence-Key только 24 часа: https://yookassa.ru/developers/using-api/interaction-format . Поэтому один ключ сам по себе недостаточен для бесконечных повторов после потерянного ответа.

Перед первым POST в существующем JSON payload события сохраняется refundPostStartedAt. Исходные business-поля intent не меняются. Version 2 отличает новые события, у которых POST ещё не начинался. Новый persisted model/field не требуется.

Если предыдущий POST неоднозначен и прошло 23 часа (запас до провайдерского лимита), повторный POST запрещён с REFUND_IDEMPOTENCY_WINDOW_EXPIRED. GET платежа/известного refund по-прежнему может подтвердить успешный возврат. Если результата нет — требуется операторская сверка, а не генерация нового ключа или удаление события.

Manual retry endpoint сохраняется: переоткрывает ТОТ ЖЕ failed intent и сбрасывает бюджет ошибок, но НЕ стирает refundId или timestamp неоднозначной отправки. Для старого failed события без маркера консервативно сохраняется event.createdAt как самая ранняя возможная отправка. Старые 8x403 нельзя автоматически считать доказательством отсутствия ВСЕХ ранее принятых запросов. Если такой intent старше окна и provider не подтверждает возврат, одного manual retry недостаточно для нового POST — нужна сверка у провайдера. Старые failed события не переоткрываются автоматически.

Ни старый ответ worker, потерявшего lease, ни повтор completed event не могут перезаписать состояние или начать второй локальный workflow. Сохраняется provider idempotency key; полная сумма и существующий refundId проверяются до отправки.

Diagnostics включают HTTP status, известный provider error code, разрешённый parameter и контролируемое описание; waiting содержит status/refundable. Сырые provider descriptions не копируются, поскольку могут содержать данные запроса, credentials или персональные данные. Для известных кодов используется безопасное нормализованное описание.

## Invoice number

Миграция `20260930120000_bank_invoice_number_sequence` создаёт sequence через CREATE SEQUENCE IF NOT EXISTS, BIGINT, START/MIN 10001, MAX 99999, NO CYCLE. Существующая production sequence не сбрасывается; setval/RESTART отсутствуют.

Под существующей блокировкой workflow сначала ищется immutable intake outbox request. Если он есть, возвращается без nextval, включая старые BI-* номера. Только новый request получает nextval внутри транзакции. Новый номер — пять цифр. Существующая UNIQUE invoiceNumber сохраняется, issued Invoice не изменяется. Уже сохранённые preparing requests тоже не переименовываются.

CRM получает request.invoiceNumber; issued Invoice, paymentPurpose, PDF и email используют тот же номер. Дополнительное форматирование в потребителях не вводилось.

После 99999 — controlled DB error/rollback, без CYCLE. Пропуски после rollback допустимы. До исчерпания диапазона необходимо отдельно согласовать расширение формата, например до 6 цифр, и проверить потребителей; автоматически это не включено.

## Изменённые файлы

Пути относительно SITE:

- `backend/src/services/crmOutbox.service.ts`: provider reconciliation в refund dispatcher, owner CAS, waiting/backoff, durable admission marker, совместимость manual retry.
- `backend/src/services/yooKassaRefund.service.ts` (новый): GET payment/refund, проверка сумм/identity, POST refund, классификация ошибок и безопасная диагностика.
- `backend/src/services/bankInvoiceDelivery.service.ts`: sequence и возврат существующего request до nextval.
- `backend/prisma/migrations/20260930120000_bank_invoice_number_sequence/migration.sql` (новый): additive sequence без сброса.
- `backend/tests/unit/services/crmOutbox.service.test.ts`: реальные по форме provider fixtures, claim ownership, GET timeout и manual retry.
- `backend/tests/unit/services/stockCompensationLifecycle.service.test.ts`: false→true, более 8 ожиданий, GET/POST ошибки, race/late success, pending refund, идемпотентность, истечение окна, legacy manual retry, lease loss, partial refund.
- `backend/tests/unit/services/invoiceNumber.test.ts` (новый): номер, retry, legacy, exhaustion.
- `backend/tests/unit/controllers/order.controller.test.ts`: fixture SQL nextval для реального checkout foundation.
- `backend/tests/integration/invoice-foundation.postgres.cjs`: старое ожидание BI-формата заменено пятизначным номером.
- `backend/tests/integration/invoice-number.postgres.cjs` (новый): реальный PostgreSQL, первый/следующий номер, конкуренция, повтор миграции, legacy, exhaustion.
- `backend/tests/integration/refund-workflow.postgres.cjs` (новый): PostgreSQL Order locks/CAS, параллельный refund, временное ожидание, pending provider refund, lost response.
- `docs/REFUND_AND_INVOICE_NUMBER_RELEASE.md`: этот отчёт и условия следующего deploy.

## Проверки

| Проверка | Результат |
|---|---|
| Targeted refund/checkout/outbox | 72/72 |
| Targeted invoice number + bank delivery | 12/12 |
| Полный backend Jest suite | 74 suites, 837/837 tests |
| TypeScript --noEmit | PASS |
| Backend TypeScript build в отдельный output | PASS |
| Prisma validate | PASS |
| Prisma generate в обычный node_modules | Windows EPERM при замене загруженного query_engine DLL, повтор вне sandbox также не помог |
| Prisma generate из того же schema с отдельным output | PASS, Prisma 5.22.0 |
| Clean local migrate deploy | 20 migrations, PASS |
| migrate status | Database schema is up to date |
| migrate diff vs schema | No difference detected |
| Реальный PG invoice sequence | 6/6 |
| Реальный PG invoice foundation | 13/13 |
| Реальный PG refund workflow | 7/7, повторный запуск тоже PASS |
| git diff --check | PASS |

Schema.prisma не менялся; Prisma drift tool не заменяет явную проверку sequence — она выполнена PG-тестом.

Baseline failures полного backend suite отсутствуют. Промежуточные падения были stale fixtures (не было provider GET response, SQL nextval и lease timestamp); assertions бизнес-поведения сохранены/усилены. Старая локальная invoice_foundation_test содержала fixture collisions CRM order IDs: foundation подтверждён на новой чистой локальной DB, старые данные не удалялись. На одном локальном запуске соединения завершились P1001; bounded pool и чистая DB прошли.

HTTP провайдера в тестах подменён, реальные списания/возвраты не выполнялись. На production тестовый paymentId из задания не запрашивался. Локальная миграция и конкурентность проверялись настоящим PostgreSQL, не SQLite.

## Следующий согласованный production deploy

1. После review закоммитить и отправить в GitHub ВСЕ файлы, включая новые migration/helper/tests; в этой работе commit/push не выполнялись.
2. Получить backup обычным установленным процессом. При deploy использовать оба compose-файла: `/var/www/swapservice38-website/docker-compose.prod.yml` и `/etc/swap38/docker-compose.vps.yml`.
3. Применить `prisma migrate deploy` с новой миграцией перед запуском нового backend; не изменять уже применённые миграции. Уже созданная вручную sequence останется на прежнем значении.
4. Собрать Prisma Client/backend в deployment environment, перезапустить штатный backend/outbox worker. Новых ENV/cron нет. Не трогать postgres/redis volumes, не применять `down -v`.
5. Удалить production-only `[BANK_INVOICE_DISPATCH_ERROR] console.error` при замене файла репозиторной версией. Локальный bank delivery уже сохраняет безопасный классифицированный OutboxEvent.lastError; сырой diagnostic patch не перенесён.
6. Проверить health, outbox pending/failed и следующий номер без искусственного расходования sequence. Существующие BI-* Invoice должны остаться неизменными.
7. Для уже failed refund использовать существующий manual retry после сверки payment/refund provider state. Не удалять intent/PaymentAttempt, не менять key и не сбрасывать timestamp, чтобы обойти защиту окна. Новые refundable=false intents продолжатся автоматически.

Постоянные production-only изменения из описания пользователя (короткий номер и sequence) теперь представлены кодом и миграцией локального repository. Реальное совпадение GitHub/VPS наступит только после последующего согласованного release; текущий отчёт не утверждает, что deploy уже выполнен.
