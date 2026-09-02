// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import redis from './config/redis';
import csrfMiddleware from './middleware/csrf.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { log } from './config/logger';
import { startCrmOutboxDispatcher, stopCrmOutboxDispatcher } from './services/crmOutbox.service';
import { closeCrmQueue } from './queues/crm.queue';

// Routes
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import adminRoutes from './routes/admin.routes';
import articlesRoutes from './routes/articles.routes';
import commentsRoutes from './routes/comments.routes';
import likesRoutes from './routes/likes.routes';
import csrfRoutes from './routes/csrf.routes';
import servicesRoutes from './routes/services.routes';
import addressRoutes from './routes/address.routes';
import uploadRoutes from './routes/upload.routes'; // ✅ ДОБАВЛЯЕМ

if (process.env.PAYMENT_PROVIDER !== 'mock' && process.env.PAYMENT_PROVIDER !== 'yookassa') {
  throw new Error('PAYMENT_PROVIDER must be explicitly set to "mock" or "yookassa"');
}
if (process.env.NODE_ENV === 'production' && process.env.PAYMENT_PROVIDER === 'mock') {
  throw new Error('Mock payment provider is forbidden in production');
}

const requiredProductionSecrets = [
  'JWT_SECRET',
  'INTERNAL_API_KEY',
  'WEBHOOK_SECRET',
  'PAYMENT_PROVIDER',
] as const;

if (process.env.NODE_ENV === 'production') {
  const paymentProvider = process.env.PAYMENT_PROVIDER;
  const paymentSecrets = paymentProvider === 'yookassa'
    ? ['YOO_KASSA_SHOP_ID', 'YOO_KASSA_SECRET_KEY'] as const
    : [];
  const missingSecrets = [...requiredProductionSecrets, ...paymentSecrets]
    .filter((name) => !process.env[name]?.trim());
  const usesTestPaymentKey = process.env.YOO_KASSA_SECRET_KEY?.startsWith('test_');
  const invalidProvider = paymentProvider !== 'yookassa';
  if (missingSecrets.length > 0 || usesTestPaymentKey || invalidProvider) {
    throw new Error(
      `Production security configuration is invalid: ${[
        ...missingSecrets,
        ...(usesTestPaymentKey ? ['YOO_KASSA_SECRET_KEY(test key)'] : []),
        ...(invalidProvider ? ['PAYMENT_PROVIDER(mock or invalid)'] : []),
      ].join(', ')}`
    );
  }
}

const app = express();
const port = process.env.PORT || 5001;

// Trust only an explicit number of reverse-proxy hops. The default (0) uses
// the direct socket address and cannot be bypassed with X-Forwarded-For.
const configuredProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);
const trustProxyHops = Number.isSafeInteger(configuredProxyHops) && configuredProxyHops > 0
  ? Math.min(configuredProxyHops, 10)
  : 0;
app.set('trust proxy', trustProxyHops);

// ============================================================
// 1. CORS
// ============================================================
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000',
  'https://swapservice38.ru',
  'https://www.swapservice38.ru',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true);
    } else {
      log.warn('CORS blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cookie',
    'X-Requested-With',
    'CSRF-Token',
    'X-CSRF-Token',
    'x-csrf-token',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// ============================================================
// 2. MIDDLEWARE
// ============================================================
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.path.includes('/webhook')) return false;
    return compression.filter(req, res);
  }
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));

app.use(cookieParser());

// RAW body для webhook
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// 3. ЛОГИРОВАНИЕ ЗАПРОСОВ
// ============================================================
app.use((req, res, next) => {
  log.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================================
// 5. SWAGGER / OPENAPI ДОКУМЕНТАЦИЯ
// ============================================================
try {
  const openapiPath = path.join(__dirname, '../docs/openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const openapiFile = fs.readFileSync(openapiPath, 'utf8');
    const swaggerDocument = yaml.load(openapiFile);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    log.info('📚 Swagger UI доступен: http://localhost:' + port + '/api-docs');
  } else {
    log.warn('⚠️ OpenAPI файл не найден: ' + openapiPath);
  }
} catch (error: any) {
  log.error('❌ Ошибка загрузки Swagger:', error.message);
}

// ============================================================
// 6. CSRF MIDDLEWARE (ДО ЗАЩИЩЁННЫХ РОУТОВ, ПОСЛЕ ПУБЛИЧНЫХ)
// ============================================================
// CSRF проверяет все запросы, кроме PUBLIC_PATHS
app.use(csrfMiddleware);

// ============================================================
// 7. ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ)
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/csrf-token', csrfRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/address', addressRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// ============================================================
// 8. ЗАЩИЩЁННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ)
// ============================================================
app.use('/api/orders', orderRoutes);

app.use('/api/payment', paymentRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/articles', articlesRoutes);

app.use('/api/comments', commentsRoutes);

app.use('/api/likes', likesRoutes);

// ============================================================
// 9. UPLOAD — ЗАЩИЩЁННЫЙ РОУТ (С АВТОРИЗАЦИЕЙ И CSRF)
// ============================================================
// ✅ Роут загрузки файлов — ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ
// CSRF уже проверен выше, uploadRoutes применяет requireAuth и проверку роли
app.use('/api/upload', uploadRoutes);

// ============================================================
// 10. СТАТИЧЕСКИЕ ФАЙЛЫ (ДЛЯ ЗАГРУЖЕННЫХ ИЗОБРАЖЕНИЙ)
// ============================================================
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
  log.info('📁 Статика uploads: ' + uploadsPath);
} else {
  fs.mkdirSync(uploadsPath, { recursive: true });
  log.info('📁 Создана папка uploads: ' + uploadsPath);
  app.use('/uploads', express.static(uploadsPath));
}

// ============================================================
// 11. ОБРАБОТЧИК 404
// ============================================================
app.use(notFoundHandler);

// ============================================================
// 12. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================================
app.use(errorHandler);

// ============================================================
// 13. ЗАПУСК (ТОЛЬКО ЕСЛИ НЕ В ТЕСТАХ!)
// ============================================================
if (require.main === module) {
  startCrmOutboxDispatcher();
  const server = app.listen(port, () => {
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info(`🚀 Site Backend running on port ${port}`);
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info(`📋 Health:     http://localhost:${port}/api/health`);
    log.info(`📚 Swagger:    http://localhost:${port}/api-docs`);
    log.info(`🔐 Auth:       http://localhost:${port}/api/auth`);
    log.info(`💰 Payment:    http://localhost:${port}/api/payment`);
    log.info(`🛡️ CSRF:       http://localhost:${port}/api/csrf-token`);
    log.info(`📦 Products:   http://localhost:${port}/api/products`);
    log.info(`🛒 Cart:       http://localhost:${port}/api/cart`);
    log.info(`📝 Orders:     http://localhost:${port}/api/orders`);
    log.info(`👑 Admin:      http://localhost:${port}/api/admin`);
    log.info(`📰 Articles:   http://localhost:${port}/api/articles`);
    log.info(`💬 Comments:   http://localhost:${port}/api/comments`);
    log.info(`❤️ Likes:      http://localhost:${port}/api/likes`);
    log.info(`📤 Upload:     http://localhost:${port}/api/upload`);
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    log.info(`📦 Redis:      ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
    log.info(`🗄️  Database:   ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}`);
    log.info(`📁 Uploads:    ${uploadsPath}`);
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });

  const shutdown = (signal: string) => {
    log.info('Shutting down website backend', { signal });
    stopCrmOutboxDispatcher();
    server.close(() => {
      void closeCrmQueue()
        .catch((error) => log.error('Failed to close CRM queue', { error }))
        .finally(() => process.exit(0));
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

// ✅ ЭКСПОРТИРУЕМ app ДЛЯ ТЕСТОВ
export { app };
