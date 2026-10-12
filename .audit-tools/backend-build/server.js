"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// backend/src/server.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const csrf_middleware_1 = __importDefault(require("./middleware/csrf.middleware"));
const error_middleware_1 = require("./middleware/error.middleware");
const logger_1 = require("./config/logger");
const emailOutbox_service_1 = require("./services/emailOutbox.service");
const email_service_1 = require("./services/email.service");
const crmOutbox_service_1 = require("./services/crmOutbox.service");
const crm_queue_1 = require("./queues/crm.queue");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const cart_routes_1 = __importDefault(require("./routes/cart.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const webhook_routes_1 = __importDefault(require("./routes/webhook.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const articles_routes_1 = __importDefault(require("./routes/articles.routes"));
const comments_routes_1 = __importDefault(require("./routes/comments.routes"));
const likes_routes_1 = __importDefault(require("./routes/likes.routes"));
const csrf_routes_1 = __importDefault(require("./routes/csrf.routes"));
const services_routes_1 = __importDefault(require("./routes/services.routes"));
const seo_routes_1 = __importDefault(require("./routes/seo.routes"));
const address_routes_1 = __importDefault(require("./routes/address.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes")); // ✅ ДОБАВЛЯЕМ
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
];
if (process.env.NODE_ENV === 'production') {
    const paymentProvider = process.env.PAYMENT_PROVIDER;
    const paymentSecrets = paymentProvider === 'yookassa'
        ? ['YOO_KASSA_SHOP_ID', 'YOO_KASSA_SECRET_KEY']
        : [];
    const missingSecrets = [...requiredProductionSecrets, ...paymentSecrets]
        .filter((name) => !process.env[name]?.trim());
    const usesTestPaymentKey = process.env.YOO_KASSA_SECRET_KEY?.startsWith('test_');
    const invalidProvider = paymentProvider !== 'yookassa';
    if (missingSecrets.length > 0 || usesTestPaymentKey || invalidProvider) {
        throw new Error(`Production security configuration is invalid: ${[
            ...missingSecrets,
            ...(usesTestPaymentKey ? ['YOO_KASSA_SECRET_KEY(test key)'] : []),
            ...(invalidProvider ? ['PAYMENT_PROVIDER(mock or invalid)'] : []),
        ].join(', ')}`);
    }
}
const app = (0, express_1.default)();
exports.app = app;
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
const configuredCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = new Set([
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3000',
    'https://swapservice38.ru',
    'https://www.swapservice38.ru',
    ...configuredCorsOrigins,
]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.has(origin)) {
            callback(null, true);
        }
        else {
            logger_1.log.warn('CORS blocked', { origin });
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
app.use((0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.path.includes('/webhook'))
            return false;
        return compression_1.default.filter(req, res);
    }
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));
app.use((0, cookie_parser_1.default)());
// RAW body для webhook
app.use('/api/payment/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '2mb' }));
// ============================================================
// 3. ЛОГИРОВАНИЕ ЗАПРОСОВ
// ============================================================
app.use((req, res, next) => {
    logger_1.log.info(`${req.method} ${req.path}`, {
        method: req.method,
        url: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});
// ============================================================
// 5. SWAGGER / OPENAPI ДОКУМЕНТАЦИЯ
// ============================================================
try {
    const openapiPath = path_1.default.join(__dirname, '../docs/openapi.yaml');
    if (fs_1.default.existsSync(openapiPath)) {
        const openapiFile = fs_1.default.readFileSync(openapiPath, 'utf8');
        const swaggerDocument = js_yaml_1.default.load(openapiFile);
        app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
        logger_1.log.info('📚 Swagger UI доступен: http://localhost:' + port + '/api-docs');
    }
    else {
        logger_1.log.warn('⚠️ OpenAPI файл не найден: ' + openapiPath);
    }
}
catch (error) {
    logger_1.log.error('❌ Ошибка загрузки Swagger:', error.message);
}
// ============================================================
// 6. CSRF MIDDLEWARE (ДО ЗАЩИЩЁННЫХ РОУТОВ, ПОСЛЕ ПУБЛИЧНЫХ)
// ============================================================
// CSRF проверяет все запросы, кроме PUBLIC_PATHS
app.use(csrf_middleware_1.default);
app.use(seo_routes_1.default);
// ============================================================
// 7. ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ)
// ============================================================
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/cart', cart_routes_1.default);
app.use('/api/webhooks', webhook_routes_1.default);
app.use('/api/csrf-token', csrf_routes_1.default);
app.use('/api/services', services_routes_1.default);
app.use('/api/address', address_routes_1.default);
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
app.use('/api/orders', order_routes_1.default);
app.use('/api/payment', payment_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/articles', articles_routes_1.default);
app.use('/api/comments', comments_routes_1.default);
app.use('/api/likes', likes_routes_1.default);
// ============================================================
// 9. UPLOAD — ЗАЩИЩЁННЫЙ РОУТ (С АВТОРИЗАЦИЕЙ И CSRF)
// ============================================================
// ✅ Роут загрузки файлов — ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ
// CSRF уже проверен выше, uploadRoutes применяет requireAuth и проверку роли
app.use('/api/upload', upload_routes_1.default);
// ============================================================
// 10. СТАТИЧЕСКИЕ ФАЙЛЫ (ДЛЯ ЗАГРУЖЕННЫХ ИЗОБРАЖЕНИЙ)
// ============================================================
const uploadsPath = path_1.default.join(__dirname, '../uploads');
if (fs_1.default.existsSync(uploadsPath)) {
    app.use('/uploads', express_1.default.static(uploadsPath));
    logger_1.log.info('📁 Статика uploads: ' + uploadsPath);
}
else {
    fs_1.default.mkdirSync(uploadsPath, { recursive: true });
    logger_1.log.info('📁 Создана папка uploads: ' + uploadsPath);
    app.use('/uploads', express_1.default.static(uploadsPath));
}
// ============================================================
// 11. ОБРАБОТЧИК 404
// ============================================================
app.use(error_middleware_1.notFoundHandler);
// ============================================================
// 12. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================================
app.use(error_middleware_1.errorHandler);
// ============================================================
// 13. ЗАПУСК (ТОЛЬКО ЕСЛИ НЕ В ТЕСТАХ!)
// ============================================================
if (require.main === module) {
    (0, crmOutbox_service_1.startCrmOutboxDispatcher)();
    (0, emailOutbox_service_1.startEmailOutboxDispatcher)(email_service_1.enqueueOutboxEmail, email_service_1.cleanupCompletedEmails);
    const server = app.listen(port, () => {
        logger_1.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger_1.log.info(`🚀 Site Backend running on port ${port}`);
        logger_1.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger_1.log.info(`📋 Health:     http://localhost:${port}/api/health`);
        logger_1.log.info(`📚 Swagger:    http://localhost:${port}/api-docs`);
        logger_1.log.info(`🔐 Auth:       http://localhost:${port}/api/auth`);
        logger_1.log.info(`💰 Payment:    http://localhost:${port}/api/payment`);
        logger_1.log.info(`🛡️ CSRF:       http://localhost:${port}/api/csrf-token`);
        logger_1.log.info(`📦 Products:   http://localhost:${port}/api/products`);
        logger_1.log.info(`🛒 Cart:       http://localhost:${port}/api/cart`);
        logger_1.log.info(`📝 Orders:     http://localhost:${port}/api/orders`);
        logger_1.log.info(`👑 Admin:      http://localhost:${port}/api/admin`);
        logger_1.log.info(`📰 Articles:   http://localhost:${port}/api/articles`);
        logger_1.log.info(`💬 Comments:   http://localhost:${port}/api/comments`);
        logger_1.log.info(`❤️ Likes:      http://localhost:${port}/api/likes`);
        logger_1.log.info(`📤 Upload:     http://localhost:${port}/api/upload`);
        logger_1.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger_1.log.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger_1.log.info(`📦 Redis:      ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
        logger_1.log.info(`🗄️  Database:   ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}`);
        logger_1.log.info(`📁 Uploads:    ${uploadsPath}`);
        logger_1.log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
    const shutdown = (signal) => {
        logger_1.log.info('Shutting down website backend', { signal });
        (0, crmOutbox_service_1.stopCrmOutboxDispatcher)();
        (0, emailOutbox_service_1.stopEmailOutboxDispatcher)();
        server.close(() => {
            void (0, crm_queue_1.closeCrmQueue)()
                .catch((error) => logger_1.log.error('Failed to close CRM queue', { error }))
                .finally(() => process.exit(0));
        });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}
//# sourceMappingURL=server.js.map