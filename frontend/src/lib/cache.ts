// frontend/lib/cache.ts
// ✅ ГЛОБАЛЬНЫЙ КЭШ ДЛЯ ВСЕГО САЙТА

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private store = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number = 300000) { // 5 минут по умолчанию
    this.store.set(key, { data, timestamp: Date.now(), ttl });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  clear() {
    this.store.clear();
  }
}

export const cache = new Cache();

// ✅ ИСПОЛЬЗУЕМ ОБЪЕКТ, А НЕ ПРЯМЫЕ ПЕРЕМЕННЫЕ
export const productCache = {
  data: null as any[] | null,
};

export const categoryCache = {
  data: null as string[] | null,
};