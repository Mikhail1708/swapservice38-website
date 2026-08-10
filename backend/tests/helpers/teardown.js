// backend/tests/helpers/teardown.ts
module.exports = async () => {
    console.log('🧹 Завершение тестов...');
    // Останавливаем интервал CSRF
    try {
        const { stopCleanupInterval } = require('../../src/middleware/csrf.middleware');
        if (stopCleanupInterval) {
            stopCleanupInterval();
        }
    }
    catch (e) {
        // ignore
    }
    // Закрываем Redis
    try {
        const redis = require('../../src/config/redis').default;
        if (redis && redis.quit) {
            await redis.quit();
        }
    }
    catch (e) {
        // ignore
    }
    // Закрываем Prisma
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$disconnect();
    }
    catch (e) {
        // ignore
    }
    console.log('✅ Тесты завершены, ресурсы освобождены');
};
//# sourceMappingURL=teardown.js.map