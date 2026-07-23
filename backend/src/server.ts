// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import redis from './config/redis';
import csrfMiddleware from './middleware/csrf.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { log } from './config/logger';

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

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

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

// CSRF
app.use(csrfMiddleware);

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
// 4. АУТЕНТИФИКАЦИЯ
// ============================================================
import { authMiddleware } from './middleware/auth.middleware';

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
// 6. ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ)
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/csrf-token', csrfRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// ============================================================
// 7. ЗАЩИЩЁННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ)
// ============================================================
app.use('/api/orders', authMiddleware);
app.use('/api/orders', orderRoutes);

app.use('/api/payment', authMiddleware);
app.use('/api/payment', paymentRoutes);

app.use('/api/admin', authMiddleware);
app.use('/api/admin', adminRoutes);

app.use('/api/articles', authMiddleware);
app.use('/api/articles', articlesRoutes);

app.use('/api/comments', authMiddleware);
app.use('/api/comments', commentsRoutes);

app.use('/api/likes', authMiddleware);
app.use('/api/likes', likesRoutes);

// ============================================================
// 8. ОБРАБОТЧИК 404
// ============================================================
app.use(notFoundHandler);

// ============================================================
// 9. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================================
app.use(errorHandler);

// ============================================================
// 10. ЗАПУСК
// ============================================================
app.listen(port, () => {
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
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  log.info(`📦 Redis:      ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  log.info(`🗄️  Database:   ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}`);
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});