// backend/src/config/redis.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('✅ Redis подключен');
});

redis.on('error', (err) => {
  console.error('❌ Redis ошибка:', err);
});

export default redis;