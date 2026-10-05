# Установка и локальный запуск SWAPSERVICE38

Руководство для разработчиков по запуску SWAPSERVICE38 Website в локальном окружении.

**Production:** https://swap38.ru  
**Repository:** https://github.com/Mikhail1708/swapservice38-website

## 1. Требования

Для разработки потребуются:

- Node.js 20 или 22.
- npm.
- Git.
- Docker Desktop с Docker Compose.
- PowerShell, Windows Terminal или другой терминал.

Проект состоит из React/Vite frontend, Express backend, PostgreSQL и Redis.

Внешняя CRM, SMTP, OAuth и платёжные сервисы настраиваются отдельно.

## 2. Клонирование

```bash
git clone https://github.com/Mikhail1708/swapservice38-website.git
cd swapservice38-website
```

## 3. Установка зависимостей

Установите зависимости backend:

```bash
cd backend
npm ci
```

Установите зависимости frontend:

```bash
cd ../frontend
npm ci
```

Вернитесь в корень:

```bash
cd ..
```

## 4. PostgreSQL и Redis

Для локальной разработки рекомендуется запускать инфраструктуру отдельно от приложений.

В корне репозитория создайте файл `docker-compose.local.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: site_user
      POSTGRES_PASSWORD: local_dev_password
      POSTGRES_DB: site_db
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - local_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - local_redis_data:/data
    command: ["redis-server", "--appendonly", "yes"]

volumes:
  local_postgres_data:
  local_redis_data:
```

Эта конфигурация предназначена исключительно для локальной разработки.

Она не заменяет production Compose.

Запустите инфраструктуру:

```bash
docker compose -f docker-compose.local.yml up -d
```

Проверьте состояние:

```bash
docker compose -f docker-compose.local.yml ps
```

## 5. Настройка backend

Скопируйте шаблон:

```powershell
Copy-Item backend/.env.example backend/.env
```

Для локального запуска настройте в `backend/.env` следующие значения:

```dotenv
NODE_ENV=development
PORT=5001
TRUST_PROXY_HOPS=0

DATABASE_URL=postgresql://site_user:local_dev_password@localhost:5433/site_db

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=replace_with_long_random_local_secret

CLIENT_URL=http://localhost:3001
CRM_API_URL=http://localhost:5000

PAYMENT_PROVIDER=mock
```

Остальные параметры заполняются в зависимости от необходимых интеграций.

**Важно:** значения `INTERNAL_API_KEY`, `WEBHOOK_SECRET`, SMTP, OAuth и других интеграций необходимо настраивать согласно требованиям backend. Для полноценного запуска могут понадобиться дополнительные корректные параметры даже при отключённых внешних сервисах.

Не используйте production-ключи в публичных примерах.

## 6. Prisma

Backend использует Prisma 5 и PostgreSQL.

Сгенерируйте Prisma Client:

```bash
cd backend
npx prisma generate
```

Примените существующие миграции:

```bash
npx prisma migrate deploy
```

`migrate deploy` применяет уже созданные миграции и не создаёт новые.

Для просмотра данных локальной БД при необходимости можно использовать Prisma Studio:

```bash
npx prisma studio
```

## 7. Запуск backend

Из каталога `backend` выполните:

```bash
npm run dev
```

Команда использует `nodemon` и `tsx`.

Адрес API:

`http://localhost:5001`

Проверка состояния:

`http://localhost:5001/api/health`

## 8. Запуск frontend

В отдельном терминале перейдите в `frontend`:

```bash
cd frontend
npm run dev
```

Frontend работает через Vite.

Адрес:

`http://localhost:3001`

Для локальной разработки Vite направляет `/api` на backend.

Настройки frontend следует сверять с `vite.config.ts` и используемыми `import.meta.env` переменными. Старые `NEXT_PUBLIC_*` в шаблонах не являются стандартными публичными переменными Vite.

## 9. Проверка

После запуска проверьте:

1. Доступность frontend на порту `3001`.
2. Ответ `/api/health`.
3. Подключение PostgreSQL.
4. Подключение Redis.
5. Отсутствие ошибок миграций.

Каталог товаров, оформление заказов, SMTP и OAuth могут требовать работающих внешних интеграций.

## 10. Тесты и сборка

Backend:

```bash
cd backend
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

Для предварительного просмотра frontend-сборки:

```bash
npm run preview
```

## 11. Docker production

В репозитории присутствуют:

- `docker-compose.prod.yml`.
- `backend/Dockerfile`.
- `frontend/Dockerfile`.

Backend использует Node.js 20, frontend собирается на Node.js 22 и обслуживается nginx.

Production Compose содержит сервисы:

- `postgres`.
- `redis`.
- `backend`.
- `frontend`.

На рабочем VPS дополнительно используется серверная конфигурация Docker Compose, не входящая в публичную инструкцию.

Production-развёртывание требует отдельной настройки:

- HTTPS и nginx.
- Секретов окружения.
- Доступа к CRM.
- YooKassa.
- SMTP.
- OAuth.
- Резервного копирования.
- Хранилищ постоянных данных.

Не используйте локальные пароли или тестовые ключи в production.

## 12. Безопасность

Не публикуйте:

- `.env`.
- `.env.local`.
- API-ключи.
- JWT secrets.
- Пароли баз данных.
- OAuth secrets.
- Платёжные credentials.

Для публикации конфигурации используйте только безопасные шаблоны `.env.example`.

## 13. Ограничения локального окружения

SWAPSERVICE38 интегрирован с отдельной CRM и внешними коммерческими сервисами.

Поэтому запуск PostgreSQL, Redis, frontend и backend не означает автоматическую доступность всех бизнес-функций.

Для полного end-to-end тестирования потребуются отдельные тестовые окружения или совместимые заглушки интеграций.

---

**Автор:** [Mikhail1708](https://github.com/Mikhail1708)  
**Проект:** [SWAPSERVICE38](https://swap38.ru)
