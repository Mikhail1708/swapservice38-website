// backend/src/config/redis.ts
import Redis from 'ioredis';

// ============================================================
// ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// ============================================================
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

console.log(`🔌 Подключение к Redis: ${REDIS_HOST}:${REDIS_PORT}`);

// ============================================================
// СОЗДАНИЕ КЛИЕНТА REDIS (БЕЗ FALLBACK)
// ============================================================
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy: (times) => {
    // После 10 попыток — критическая ошибка
    if (times > 10) {
      console.error(`❌ Redis недоступен после ${times} попыток`);
      process.exit(1);
    }
    // Экспоненциальная задержка: 1с, 2с, 4с, 8с...
    return Math.min(times * 1000, 5000);
  },
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  connectTimeout: 5000,
  commandTimeout: 5000,
});

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
redis.on('connect', () => {
  console.log('✅ Redis подключен');
});

redis.on('ready', () => {
  console.log('✅ Redis готов к работе');
});

redis.on('error', (error) => {
  console.error('❌ Redis ошибка:', error.message);
});

redis.on('close', () => {
  console.warn('⚠️ Соединение с Redis закрыто');
});

redis.on('reconnecting', (delay) => {
  console.log(`🔄 Переподключение к Redis через ${delay}ms`);
});

// ============================================================
// ПРОВЕРКА ПОДКЛЮЧЕНИЯ (ПРИ ЗАПУСКЕ)
// ============================================================
const checkConnection = async () => {
  try {
    await redis.ping();
    console.log('✅ Redis ping успешен');
  } catch (error) {
    console.error('❌ Redis ping не удался:', error);
    process.exit(1);
  }
};

// Выполняем проверку
checkConnection();

// ============================================================
// ЭКСПОРТ
// ============================================================
export default redis;

// ============================================================
// БЕЗОПАСНЫЕ ХЕЛПЕРЫ (С ОБРАБОТКОЙ ОШИБОК)
// ============================================================
export const safeRedis = {
  get: async (key: string): Promise<string | null> => {
    try {
      return await redis.get(key);
    } catch (error) {
      console.error(`❌ Redis get error [${key}]:`, error);
      throw error;
    }
  },

  setex: async (key: string, ttl: number, value: string): Promise<void> => {
    try {
      await redis.setex(key, ttl, value);
    } catch (error) {
      console.error(`❌ Redis setex error [${key}]:`, error);
      throw error;
    }
  },

  del: async (key: string): Promise<number> => {
    try {
      return await redis.del(key);
    } catch (error) {
      console.error(`❌ Redis del error [${key}]:`, error);
      throw error;
    }
  },

  keys: async (pattern: string): Promise<string[]> => {
    try {
      return await redis.keys(pattern);
    } catch (error) {
      console.error(`❌ Redis keys error [${pattern}]:`, error);
      throw error;
    }
  },

  incr: async (key: string): Promise<number> => {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error(`❌ Redis incr error [${key}]:`, error);
      throw error;
    }
  },

  expire: async (key: string, ttl: number): Promise<number> => {
    try {
      return await redis.expire(key, ttl);
    } catch (error) {
      console.error(`❌ Redis expire error [${key}]:`, error);
      throw error;
    }
  },

  ttl: async (key: string): Promise<number> => {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`❌ Redis ttl error [${key}]:`, error);
      throw error;
    }
  },

  flushall: async (): Promise<void> => {
    try {
      await redis.flushall();
    } catch (error) {
      console.error('❌ Redis flushall error:', error);
      throw error;
    }
  },

  // ✅ ДЛЯ РАБОТЫ С JSON
  setJson: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
    try {
      const json = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, json);
      } else {
        await redis.set(key, json);
      }
    } catch (error) {
      console.error(`❌ Redis setJson error [${key}]:`, error);
      throw error;
    }
  },

  getJson: async <T>(key: string): Promise<T | null> => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`❌ Redis getJson error [${key}]:`, error);
      throw error;
    }
  },
};