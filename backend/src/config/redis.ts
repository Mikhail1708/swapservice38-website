// backend/src/config/redis.ts
import Redis from 'ioredis';

// Fallback хранилище
const fallbackStore = new Map<string, { value: string, expiresAt: number }>();

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
    for (const key of fallbackStore.keys()) {
      if (key.match(pattern.replace('*', '.*'))) {
        results.push(key);
      }
    }
    return results;
  },
  on: (event: string, callback: Function) => {
    if (event === 'connect') callback();
    return createFallbackRedis();
  },
  duplicate: () => createFallbackRedis(),
  defineCommand: () => {},
  get client() { return createFallbackRedis(); },
  get subscribers() { return createFallbackRedis(); },
  ping: async () => 'PONG',
  quit: async () => 'OK',
});

let redis: any;

try {
  const realRedis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 2) {
        console.warn('⚠️ Redis недоступен, переключаемся на fallback');
        return null;
      }
      return Math.min(times * 1000, 2000);
    },
  });

  // Проверяем подключение
  const checkConnection = async () => {
    try {
      await Promise.race([
        realRedis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      console.log('✅ Redis подключен');
      redis = realRedis;
    } catch (error) {
      console.warn('⚠️ Redis не доступен, используем fallback');
      redis = createFallbackRedis();
    }
  };

  checkConnection().catch(() => {
    console.warn('⚠️ Redis ошибка, используем fallback');
    redis = createFallbackRedis();
  });

} catch (error) {
  console.warn('⚠️ Redis не доступен, используем fallback');
  redis = createFallbackRedis();
}

export default redis;