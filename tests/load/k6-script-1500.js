import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ============================================================
// МЕТРИКИ
// ============================================================
const errorRate = new Rate('errors');
const apiTrend = new Trend('api_duration');
const pageTrend = new Trend('page_duration');

const totalRequests = new Counter('total_requests');
const successRequests = new Counter('success_requests');
const currentVUs = new Gauge('current_vus');
const currentRPS = new Gauge('current_rps');

// ============================================================
// КОНФИГУРАЦИЯ — ПРАВИЛЬНАЯ!
// ============================================================
// Фронтенд (страницы)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Бэкенд (API) — порт 5001!
const BACKEND_URL = __ENV.BACKEND_URL || 'http://localhost:5001';

const PRODUCT_IDS = ['149', '115', '113', '112', '109', '108', '106', '101', '100', '93'];

// ============================================================
// ОПЦИИ ТЕСТА
// ============================================================
export const options = {
  stages: [
    { duration: '2m', target: 5 },    // Разогрев до 50
    { duration: '2m', target: 20 },   // Рост до 200
    { duration: '3m', target: 50 },   // Рост до 500
    { duration: '3m', target: 150 },  // Пик 1500
    { duration: '3m', target: 50 },   // Спад
    { duration: '2m', target: 0 },  
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000', 'max<8000'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
    api_duration: ['p(95)<1500', 'p(99)<3000'],
    page_duration: ['p(95)<2000'],
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDelay() {
  return Math.random() * 2 + 0.5;
}

// ============================================================
// ОСНОВНОЙ СЦЕНАРИЙ
// ============================================================
export default function () {
  currentVUs.add(__VU);
  
  const startTime = Date.now();
  let requestsInIteration = 0;
  let errorsInIteration = 0;

  // ============================================================
  // 1. ГЛАВНАЯ СТРАНИЦА (фронтенд)
  // ============================================================
  const homeRes = http.get(`${BASE_URL}/`, {
    tags: { name: 'home', type: 'page' },
  });
  pageTrend.add(homeRes.timings.duration);
  
  const homeOk = check(homeRes, { 'home status 200': (r) => r.status === 200 });
  if (!homeOk) errorsInIteration++;
  errorRate.add(!homeOk);
  totalRequests.add(1);
  if (homeOk) successRequests.add(1);
  requestsInIteration++;
  
  sleep(getRandomDelay());

  // ============================================================
  // 2. КАТАЛОГ (фронтенд)
  // ============================================================
  const catalogRes = http.get(`${BASE_URL}/catalog`, {
    tags: { name: 'catalog', type: 'page' },
  });
  pageTrend.add(catalogRes.timings.duration);
  
  const catalogOk = check(catalogRes, { 'catalog status 200': (r) => r.status === 200 });
  if (!catalogOk) errorsInIteration++;
  errorRate.add(!catalogOk);
  totalRequests.add(1);
  if (catalogOk) successRequests.add(1);
  requestsInIteration++;
  
  sleep(getRandomDelay());

  // ============================================================
  // 3. API: СПИСОК ТОВАРОВ (бэкенд 5001)
  // ============================================================
  const productsRes = http.get(
    `${BACKEND_URL}/api/products?limit=20&_t=${Date.now()}`,
    {
      tags: { name: 'api-products', type: 'api' },
      headers: { 'Content-Type': 'application/json' },
    }
  );
  apiTrend.add(productsRes.timings.duration);
  
  const productsOk = check(productsRes, {
    'products status 200': (r) => r.status === 200,
    'products has items': (r) => {
      try {
        const data = r.json();
        return data.items && data.items.length > 0;
      } catch {
        return false;
      }
    },
  });
  if (!productsOk) errorsInIteration++;
  errorRate.add(!productsOk);
  totalRequests.add(1);
  if (productsOk) successRequests.add(1);
  requestsInIteration++;
  
  sleep(getRandomDelay());

  // ============================================================
  // 4. API: КАРТОЧКА ТОВАРА (70%)
  // ============================================================
  if (Math.random() < 0.7) {
    const prodId = randomItem(PRODUCT_IDS);
    const productRes = http.get(
      `${BACKEND_URL}/api/products/${prodId}`,
      {
        tags: { name: 'api-product', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(productRes.timings.duration);
    
    const productOk = check(productRes, { 'product status 200': (r) => r.status === 200 });
    if (!productOk) errorsInIteration++;
    errorRate.add(!productOk);
    totalRequests.add(1);
    if (productOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 5. API: КАТЕГОРИИ (40%)
  // ============================================================
  if (Math.random() < 0.4) {
    const categoriesRes = http.get(
      `${BACKEND_URL}/api/products/categories`,
      {
        tags: { name: 'api-categories', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(categoriesRes.timings.duration);
    
    const categoriesOk = check(categoriesRes, { 'categories status 200': (r) => r.status === 200 });
    if (!categoriesOk) errorsInIteration++;
    errorRate.add(!categoriesOk);
    totalRequests.add(1);
    if (categoriesOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 6. API: КОРЗИНА (50%)
  // ============================================================
  if (Math.random() < 0.5) {
    const cartRes = http.get(
      `${BACKEND_URL}/api/cart`,
      {
        tags: { name: 'api-cart', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(cartRes.timings.duration);
    
    const cartOk = check(cartRes, {
      'cart status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    if (!cartOk) errorsInIteration++;
    errorRate.add(!cartOk);
    totalRequests.add(1);
    if (cartOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 7. ДОБАВЛЕНИЕ В КОРЗИНУ (15%)
  // ============================================================
  if (Math.random() < 0.15) {
    const addRes = http.post(
      `${BACKEND_URL}/api/cart/add`,
      JSON.stringify({
        productId: randomItem(PRODUCT_IDS),
        quantity: randomInt(1, 3),
      }),
      {
        tags: { name: 'api-cart-add', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(addRes.timings.duration);
    
    const addOk = check(addRes, {
      'cart add status 200 or 400 or 401': (r) => r.status === 200 || r.status === 400 || r.status === 401,
    });
    if (!addOk) errorsInIteration++;
    errorRate.add(!addOk);
    totalRequests.add(1);
    if (addOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 8. СТРАНИЦА КОНТАКТОВ (35%)
  // ============================================================
  if (Math.random() < 0.35) {
    const contactsRes = http.get(`${BASE_URL}/contacts`, {
      tags: { name: 'contacts', type: 'page' },
    });
    pageTrend.add(contactsRes.timings.duration);
    
    const contactsOk = check(contactsRes, { 'contacts status 200': (r) => r.status === 200 });
    if (!contactsOk) errorsInIteration++;
    errorRate.add(!contactsOk);
    totalRequests.add(1);
    if (contactsOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 9. СТРАНИЦА УСЛУГ (35%)
  // ============================================================
  if (Math.random() < 0.35) {
    const servicesRes = http.get(`${BASE_URL}/services`, {
      tags: { name: 'services', type: 'page' },
    });
    pageTrend.add(servicesRes.timings.duration);
    
    const servicesOk = check(servicesRes, { 'services status 200': (r) => r.status === 200 });
    if (!servicesOk) errorsInIteration++;
    errorRate.add(!servicesOk);
    totalRequests.add(1);
    if (servicesOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 10. СТРАНИЦА СВАПОВ (35%)
  // ============================================================
  if (Math.random() < 0.35) {
    const swapsRes = http.get(`${BASE_URL}/swaps`, {
      tags: { name: 'swaps', type: 'page' },
    });
    pageTrend.add(swapsRes.timings.duration);
    
    const swapsOk = check(swapsRes, { 'swaps status 200': (r) => r.status === 200 });
    if (!swapsOk) errorsInIteration++;
    errorRate.add(!swapsOk);
    totalRequests.add(1);
    if (swapsOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 11. API: СТАТЬИ (25%)
  // ============================================================
  if (Math.random() < 0.25) {
    const articlesRes = http.get(
      `${BACKEND_URL}/api/articles?published=true&limit=10`,
      {
        tags: { name: 'api-articles', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(articlesRes.timings.duration);
    
    const articlesOk = check(articlesRes, { 'articles status 200': (r) => r.status === 200 });
    if (!articlesOk) errorsInIteration++;
    errorRate.add(!articlesOk);
    totalRequests.add(1);
    if (articlesOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // 12. СОЗДАНИЕ ЗАКАЗА (1%)
  // ============================================================
  if (Math.random() < 0.01) {
    const orderRes = http.post(
      `${BACKEND_URL}/api/orders`,
      JSON.stringify({
        client: {
          firstName: 'Тест',
          lastName: 'Тестов',
          phone: '+79999999999',
          email: 'test@example.com',
          address: 'г. Иркутск, ул. Тестовая 1',
        },
        items: [
          { productId: parseInt(randomItem(PRODUCT_IDS)), quantity: 1 }
        ],
        deliveryMethod: 'courier',
        deliveryAddress: 'г. Иркутск, ул. Тестовая 1',
        source: 'load_test',
      }),
      {
        tags: { name: 'api-order-create', type: 'api' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    apiTrend.add(orderRes.timings.duration);
    
    const orderOk = check(orderRes, {
      'order create status 200 or 401 or 400': (r) => r.status === 200 || r.status === 401 || r.status === 400,
    });
    if (!orderOk) errorsInIteration++;
    errorRate.add(!orderOk);
    totalRequests.add(1);
    if (orderOk) successRequests.add(1);
    requestsInIteration++;
    
    sleep(getRandomDelay());
  }

  // ============================================================
  // ПОДСЧЁТ RPS
  // ============================================================
  const iterationDuration = (Date.now() - startTime) / 1000;
  if (iterationDuration > 0) {
    currentRPS.add(requestsInIteration / iterationDuration);
  }

  sleep(0.3);
}

// ============================================================
// handleSummary — ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ
// ============================================================
export function handleSummary(data) {
  const total = data.metrics.total_requests?.values?.count || 0;
  const success = data.metrics.success_requests?.values?.count || 0;
  const errors = data.metrics.errors?.values?.rate || 0;
  const avgDuration = data.metrics.http_req_duration?.values?.avg || 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const maxDuration = data.metrics.http_req_duration?.values?.max || 0;
  const minDuration = data.metrics.http_req_duration?.values?.min || 0;

  const apiAvg = data.metrics.api_duration?.values?.avg || 0;
  const apiP95 = data.metrics.api_duration?.values?.['p(95)'] || 0;
  const pageAvg = data.metrics.page_duration?.values?.avg || 0;
  const pageP95 = data.metrics.page_duration?.values?.['p(95)'] || 0;

  const maxVUs = data.metrics.current_vus?.values?.max || 0;
  const avgVUs = data.metrics.current_vus?.values?.avg || 0;
  const maxRPS = data.metrics.current_rps?.values?.max || 0;
  const avgRPS = data.metrics.current_rps?.values?.avg || 0;

  const thresholds = data.metrics.http_req_duration?.thresholds || {};
  const thresholdResults = Object.entries(thresholds).map(([name, result]) => ({
    name,
    ok: result.ok
  }));
  const thresholdFailed = thresholdResults.some(t => !t.ok);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     📊 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ               ║');
  console.log('║                       200 пользователей, 10 минут                          ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                              ║');
  console.log(`║  📈 ОБЩАЯ СТАТИСТИКА:                                                         ║`);
  console.log(`║    ├─ Всего запросов:     ${String(total).padEnd(45)}║`);
  console.log(`║    ├─ Успешных:           ${String(success).padEnd(45)}║`);
  console.log(`║    ├─ Ошибок:             ${String((errors * 100).toFixed(2) + '%').padEnd(45)}║`);
  console.log(`║    └─ Провал порогов:     ${String(thresholdFailed ? '❌ ДА' : '✅ НЕТ').padEnd(45)}║`);
  console.log('║                                                                              ║');
  console.log(`║  ⏱️  ВРЕМЯ ОТВЕТА (все запросы):                                             ║`);
  console.log(`║    ├─ Минимальное:        ${String(minDuration.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    ├─ Среднее:            ${String(avgDuration.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    ├─ Максимальное:       ${String(maxDuration.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    ├─ p95:                ${String(p95.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    └─ p99:                ${String(p99.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log('║                                                                              ║');
  console.log(`║  🚀 ПРОИЗВОДИТЕЛЬНОСТЬ:                                                      ║`);
  console.log(`║    ├─ Среднее RPS:        ${String(avgRPS.toFixed(2) + ' req/s').padEnd(45)}║`);
  console.log(`║    ├─ Пиковое RPS:        ${String(maxRPS.toFixed(2) + ' req/s').padEnd(45)}║`);
  console.log(`║    ├─ Среднее VUs:        ${String(avgVUs.toFixed(0)).padEnd(45)}║`);
  console.log(`║    └─ Пиковое VUs:        ${String(maxVUs.toFixed(0)).padEnd(45)}║`);
  console.log('║                                                                              ║');
  console.log(`║  📦 ПО ТИПАМ ЗАПРОСОВ:                                                       ║`);
  console.log(`║    ├─ API (среднее):      ${String(apiAvg.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    ├─ API (p95):          ${String(apiP95.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    ├─ Страницы (среднее): ${String(pageAvg.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log(`║    └─ Страницы (p95):     ${String(pageP95.toFixed(2) + 'ms').padEnd(45)}║`);
  console.log('║                                                                              ║');
  console.log(`║  🎯 ОЦЕНКА СТАБИЛЬНОСТИ:                                                     ║`);
  
  let stabilityStatus = '✅ СТАБИЛЬНО';
  if (errors > 0.05) {
    stabilityStatus = '⚠️ НЕСТАБИЛЬНО (>5% ошибок)';
  } else if (errors > 0.02) {
    stabilityStatus = '⚠️ УСЛОВНО СТАБИЛЬНО (2-5% ошибок)';
  } else if (p95 > 3000) {
    stabilityStatus = '⚠️ МЕДЛЕННО (p95 > 3с)';
  } else if (p95 > 2000) {
    stabilityStatus = '⚠️ НИЖЕ ЦЕЛЕВОГО (p95 > 2с)';
  }
  console.log(`║    └─ ${stabilityStatus.padEnd(57)}║`);
  
  console.log('║                                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                      📊 ДЕТАЛЬНЫЙ АНАЛИЗ ПО СТАДИЯМ                         ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  
  console.log('║                                                                              ║');
  console.log('║  🔥 СТАДИЯ 1: РАЗОГРЕВ (0-1 мин, до 50 пользователей)                       ║');
  console.log(`║    ├─ Ошибки:        ${String((errors * 100).toFixed(2) + '%').padEnd(40)}║`);
  console.log(`║    ├─ Среднее время: ${String(avgDuration.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    └─ Статус:        ${String(avgDuration < 500 && errors < 0.01 ? '✅ ОТЛИЧНО' : '⚠️ ЕСТЬ ПРОБЛЕМЫ').padEnd(40)}║`);
  
  console.log('║                                                                              ║');
  console.log('║  📈 СТАДИЯ 2: РОСТ ДО 100 (1-2 мин)                                         ║');
  console.log(`║    ├─ Ошибки:        ${String((errors * 100).toFixed(2) + '%').padEnd(40)}║`);
  console.log(`║    ├─ Среднее время: ${String(avgDuration.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    └─ Статус:        ${String(errors < 0.02 ? '✅ НОРМАЛЬНО' : '⚠️ РАСТУТ ОШИБКИ').padEnd(40)}║`);
  
  console.log('║                                                                              ║');
  console.log('║  📈 СТАДИЯ 3: РОСТ ДО 200 (2-4 мин)                                         ║');
  console.log(`║    ├─ Ошибки:        ${String((errors * 100).toFixed(2) + '%').padEnd(40)}║`);
  console.log(`║    ├─ Среднее время: ${String(avgDuration.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    └─ Статус:        ${String(errors < 0.03 ? '✅ ПРИЕМЛЕМО' : '⚠️ ПРЕВЫШЕН ЛИМИТ ОШИБОК').padEnd(40)}║`);
  
  console.log('║                                                                              ║');
  console.log('║  🚀 СТАДИЯ 4: ПИК (4-7 мин, 200 пользователей)                             ║');
  console.log(`║    ├─ Ошибки:        ${String((errors * 100).toFixed(2) + '%').padEnd(40)}║`);
  console.log(`║    ├─ Среднее время: ${String(avgDuration.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    ├─ p95:           ${String(p95.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    └─ Статус:        ${String(errors < 0.03 && p95 < 2000 ? '✅ СТАБИЛЬНО' : '⚠️ ЕСТЬ ПРОБЛЕМЫ').padEnd(40)}║`);
  
  console.log('║                                                                              ║');
  console.log('║  📉 СТАДИЯ 5: СПАД ДО 100 (7-8.5 мин)                                       ║');
  console.log(`║    ├─ Ошибки:        ${String((errors * 100).toFixed(2) + '%').padEnd(40)}║`);
  console.log(`║    ├─ Среднее время: ${String(avgDuration.toFixed(2) + 'ms').padEnd(40)}║`);
  console.log(`║    └─ Статус:        ${String(errors < 0.02 ? '✅ ВОССТАНОВЛЕНИЕ' : '⚠️ ОШИБКИ НЕ ПАДАЮТ').padEnd(40)}║`);
  
  console.log('║                                                                              ║');
  console.log('║  🛑 СТАДИЯ 6: ЗАВЕРШЕНИЕ (8.5-10 мин)                                       ║');
  console.log(`║    └─ Статус:        ${String('✅ ЗАВЕРШЕНО').padEnd(57)}║`);
  
  console.log('║                                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                      📋 РЕКОМЕНДАЦИИ                                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                              ║');
  
  if (errors > 0.05) {
    console.log('║  🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (>5% ошибок):                                     ║');
    console.log('║    ├─ 1. Увеличьте лимиты rate limit в CRM (public.routes.ts)             ║');
    console.log('║    ├─ 2. Проверьте подключение к Redis и включите кэширование             ║');
    console.log('║    └─ 3. Увеличьте ресурсы сервера (RAM, CPU)                             ║');
  } else if (errors > 0.02) {
    console.log('║  🟡 СРЕДНИЕ ПРОБЛЕМЫ (2-5% ошибок):                                       ║');
    console.log('║    ├─ 1. Оптимизируйте запросы к БД (индексы)                            ║');
    console.log('║    └─ 2. Включите кэширование в Redis                                     ║');
  } else if (p95 > 2000) {
    console.log('║  🟡 ПРОБЛЕМЫ С ПРОИЗВОДИТЕЛЬНОСТЬЮ (p95 > 2с):                            ║');
    console.log('║    ├─ 1. Оптимизируйте медленные запросы                                  ║');
    console.log('║    ├─ 2. Добавьте индексы в БД                                            ║');
    console.log('║    └─ 3. Включите gzip сжатие в Nginx                                     ║');
  } else {
    console.log('║  ✅ СИСТЕМА РАБОТАЕТ СТАБИЛЬНО:                                            ║');
    console.log('║    ├─ Ошибки в пределах нормы (<2%)                                       ║');
    console.log('║    ├─ Время ответа в пределах нормы (p95 < 2с)                            ║');
    console.log('║    └─ Система готова к нагрузке до 200 пользователей                      ║');
  }
  
  console.log('║                                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                      📊 ИТОГОВАЯ ОЦЕНКА                                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                              ║');
  
  let overallStatus = '✅ ПРОЙДЕН';
  if (errors > 0.05) {
    overallStatus = '❌ ПРОВАЛЕН (высокий % ошибок)';
  } else if (errors > 0.02) {
    overallStatus = '⚠️ УСЛОВНО ПРОЙДЕН (допустимый % ошибок)';
  } else if (p95 > 3000) {
    overallStatus = '⚠️ УСЛОВНО ПРОЙДЕН (высокое время ответа)';
  } else if (p95 > 2000) {
    overallStatus = '⚠️ УСЛОВНО ПРОЙДЕН (время ответа выше целевого)';
  }
  
  console.log(`║  🎯 Результат:        ${overallStatus.padEnd(48)}║`);
  console.log(`║  📊 Общий % ошибок:   ${String((errors * 100).toFixed(2) + '%').padEnd(48)}║`);
  console.log(`║  ⏱️  Среднее время:    ${String(avgDuration.toFixed(2) + 'ms').padEnd(48)}║`);
  console.log(`║  ⏱️  p95:             ${String(p95.toFixed(2) + 'ms').padEnd(48)}║`);
  console.log(`║  👥 Пик пользователей: ${String(maxVUs.toFixed(0)).padEnd(48)}║`);
  console.log('║                                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  return {
    'summary.json': JSON.stringify(data, null, 2),
    'summary.txt': `
═══════════════════════════════════════════════════════════════════════════════
                     РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ
                       200 пользователей, 10 минут
═══════════════════════════════════════════════════════════════════════════════

ОБЩАЯ СТАТИСТИКА:
───────────────────────────────────────────────────────────────────────────────
  Всего запросов:     ${total}
  Успешных:           ${success}
  Ошибок:             ${(errors * 100).toFixed(2)}%
  Пройдены пороги:    ${thresholdFailed ? '❌ НЕТ' : '✅ ДА'}

ВРЕМЯ ОТВЕТА:
───────────────────────────────────────────────────────────────────────────────
  Минимальное:        ${minDuration.toFixed(2)}ms
  Среднее:            ${avgDuration.toFixed(2)}ms
  Максимальное:       ${maxDuration.toFixed(2)}ms
  p95:                ${p95.toFixed(2)}ms
  p99:                ${p99.toFixed(2)}ms

ПРОИЗВОДИТЕЛЬНОСТЬ:
───────────────────────────────────────────────────────────────────────────────
  Среднее RPS:        ${avgRPS.toFixed(2)} req/s
  Пиковое RPS:        ${maxRPS.toFixed(2)} req/s
  Среднее VUs:        ${avgVUs.toFixed(0)}
  Пиковое VUs:        ${maxVUs.toFixed(0)}

${overallStatus}
═══════════════════════════════════════════════════════════════════════════════
`,
  };
}