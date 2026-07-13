// backend/src/config/redis.ts
import Redis from 'ioredis';

// ============================================================
// FALLBACK ХРАНИЛИЩЕ (РАБОТАЕТ БЕЗ REDIS)
// ============================================================
const fallbackStore = new Map<string, { value: string, expiresAt: number }>();

// Очистка просроченных записей (каждые 60 секунд)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackStore) {
    if (now > entry.expiresAt) {
      fallbackStore.delete(key);
    }
  }
}, 60000);

const createFallbackRedis = () => ({
  setex: async (key: string, ttl: number, value: string) => {
    fallbackStore.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    console.log(`📦 Redis fallback: setex ${key}`);
    return 'OK';
  },
  get: async (key: string) => {
    const entry = fallbackStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      fallbackStore.delete(key);
      return null;
    }
    return entry.value;
  },
  del: async (key: string) => {
    return fallbackStore.delete(key) ? 1 : 0;
  },
  keys: async (pattern: string) => {
    const results: string[] = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of fallbackStore.keys()) {
      if (regex.test(key)) {
        results.push(key);
      }
    }
    return results;
  },
  on: (event: string, callback: Function) => {
    if (event === 'connect') {
      setTimeout(() => callback(), 0);
    }
    return createFallbackRedis();
  },
  duplicate: () => createFallbackRedis(),
  defineCommand: () => {},
  get client() { return createFallbackRedis(); },
  get subscribers() { return createFallbackRedis(); },
  ping: async () => 'PONG',
  quit: async () => 'OK',
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ REDIS
// ============================================================
let redis: any;
let isRedisConnected = false;

// ✅ ВСЕГДА СОЗДАЁМ FALLBACK
const fallback = createFallbackRedis();

try {
  const realRedis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️ Redis недоступен, переключаемся на fallback');
        return null;
      }
      return Math.min(times * 1000, 3000);
    },
    maxRetriesPerRequest: 2,
  });

  // ✅ СРАЗУ ВОЗВРАЩАЕМ FALLBACK, ПОКА НЕ ПОДКЛЮЧИМСЯ
  redis = fallback;

  // Проверка подключения
  const checkConnection = async () => {
    try {
      await Promise.race([
        realRedis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      console.log('✅ Redis подключен');
      isRedisConnected = true;
      // ✅ ПЕРЕКЛЮЧАЕМСЯ НА РЕАЛЬНЫЙ REDIS
      redis = realRedis;
    } catch (error) {
      console.warn('⚠️ Redis не доступен, используем fallback');
      // ✅ ОСТАЁМСЯ НА FALLBACK
      redis = fallback;
    }
  };

  // Запускаем проверку
  checkConnection();

} catch (error) {
  console.warn('⚠️ Redis ошибка, используем fallback');
  redis = fallback;
}

// ============================================================
// ГАРАНТИРУЕМ, ЧТО redis ВСЕГДА ОПРЕДЕЛЁН
// ============================================================
export default redis;

// ============================================================
// ХЕЛПЕРЫ ДЛЯ РАБОТЫ С REDIS (БЕЗОПАСНЫЕ)
// ============================================================
export const safeRedis = {
  get: async (key: string): Promise<string | null> => {
    try {
      if (redis && typeof redis.get === 'function') {
        return await redis.get(key);
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Redis get error for ${key}:`, error);
      return null;
    }
  },
  setex: async (key: string, ttl: number, value: string): Promise<void> => {
    try {
      if (redis && typeof redis.setex === 'function') {
        await redis.setex(key, ttl, value);
      }
    } catch (error) {
      console.warn(`⚠️ Redis setex error for ${key}:`, error);
    }
  },
  del: async (key: string): Promise<void> => {
    try {
      if (redis && typeof redis.del === 'function') {
        await redis.del(key);
      }
    } catch (error) {
      console.warn(`⚠️ Redis del error for ${key}:`, error);
    }
  },
  keys: async (pattern: string): Promise<string[]> => {
    try {
      if (redis && typeof redis.keys === 'function') {
        return await redis.keys(pattern);
      }
      return [];
    } catch (error) {
      console.warn(`⚠️ Redis keys error for ${pattern}:`, error);
      return [];
    }
  },
};