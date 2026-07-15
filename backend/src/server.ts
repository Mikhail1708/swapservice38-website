// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import redis from './config/redis';
import csrfMiddleware from './middleware/csrf.middleware';

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
      console.warn('🚫 CORS blocked:', origin);
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

// RAW body для webhook (ДО express.json)
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// 3. ЛОГИРОВАНИЕ
// ============================================================
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// ============================================================
// 4. CSRF ЗАЩИТА (ТОЛЬКО ДЛЯ НЕ-ПУБЛИЧНЫХ POST/PUT/DELETE/PATCH)
// ============================================================
// Публичные пути пропускают CSRF внутри middleware
app.use(csrfMiddleware);

// ============================================================
// 5. АУТЕНТИФИКАЦИЯ
// ============================================================
import { authMiddleware } from './middleware/auth.middleware';

// ============================================================
// 6. ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ)
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/csrf-token', csrfRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// ============================================================
// 7. ЗАЩИЩЁННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ)
// ============================================================

// Заказы
app.use('/api/orders', authMiddleware);
app.use('/api/orders', orderRoutes);

// Платежи
app.use('/api/payment', authMiddleware);
app.use('/api/payment', paymentRoutes);

// Админ-панель
app.use('/api/admin', authMiddleware);
app.use('/api/admin', adminRoutes);

// Статьи
app.use('/api/articles', authMiddleware);
app.use('/api/articles', articlesRoutes);

// Комментарии
app.use('/api/comments', authMiddleware);
app.use('/api/comments', commentsRoutes);

// Лайки
app.use('/api/likes', authMiddleware);
app.use('/api/likes', likesRoutes);

// ============================================================
// 8. ОБРАБОТЧИК 404
// ============================================================
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Не найдено',
    path: req.path 
  });
});

// ============================================================
// 9. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);

  // CSRF ошибка
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Неверный CSRF токен',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  // Ошибка валидации
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.errors
    });
  }

  // Ошибка аутентификации
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Не авторизован'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера',
  });
});

// ============================================================
// 10. ЗАПУСК
// ============================================================
app.listen(port, () => {
  console.log(`🚀 Site Backend running on port ${port}`);
  console.log(`📋 Health: http://localhost:${port}/api/health`);
  console.log(`🔐 Auth: http://localhost:${port}/api/auth`);
  console.log(`💰 Payment: http://localhost:${port}/api/payment`);
  console.log(`🛡️ CSRF: http://localhost:${port}/api/csrf-token`);
  console.log(`📦 Products: http://localhost:${port}/api/products`);
  console.log(`🛒 Cart: http://localhost:${port}/api/cart`);
  console.log(`📝 Orders: http://localhost:${port}/api/orders`);
  console.log(`👑 Admin: http://localhost:${port}/api/admin`);
  console.log(`📰 Articles: http://localhost:${port}/api/articles`);
  console.log(`💬 Comments: http://localhost:${port}/api/comments`);
  console.log(`❤️ Likes: http://localhost:${port}/api/likes`);
});