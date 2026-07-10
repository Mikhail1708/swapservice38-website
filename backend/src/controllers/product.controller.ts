// backend/src/controllers/product.controller.ts (САЙТ, порт 5001)
import { Request, Response } from 'express';
import axios from 'axios';
import redis from '../config/redis';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
const CACHE_TTL = 600; // 5 минут

/**
 * GET /api/products
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = '1', limit = '16' } = req.query;
    
    console.log('📦 Запрос товаров из CRM:', { category, search, page, limit });

    const cacheKey = `products:${category || 'all'}:${search || 'all'}:${page}:${limit}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Товары из кэша');
        res.json(JSON.parse(cached));
        return;
      }
    } catch (error) {
      console.warn('⚠️ Redis error:', error);
    }

    const response = await axios.get(`${CRM_API_URL}/api/public/products`, {
      params: { category, search, page, limit },
      timeout: 10000,
    });

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response.data));
    } catch (error) {
      console.warn('⚠️ Redis set error:', error);
    }

    res.json(response.data);
  } catch (error: any) {
    console.error('❌ Ошибка получения товаров:', error);
    res.status(500).json({ 
      error: 'Ошибка получения товаров',
      details: error.message 
    });
  }
};

/**
 * GET /api/products/:id
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    console.log(`📦 Запрос товара ${id} из CRM`);

    const cacheKey = `product:${id}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Товар из кэша');
        res.json(JSON.parse(cached));
        return;
      }
    } catch (error) {
      console.warn('⚠️ Redis error:', error);
    }

    const response = await axios.get(`${CRM_API_URL}/api/public/products/${id}`, {
      timeout: 10000,
    });

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response.data));
    } catch (error) {
      console.warn('⚠️ Redis set error:', error);
    }

    res.json(response.data);
  } catch (error: any) {
    console.error(`❌ Ошибка получения товара ${req.params.id}:`, error);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }
    
    res.status(500).json({ 
      error: 'Ошибка получения товара',
      details: error.message 
    });
  }
};

/**
 * GET /api/products/categories
 * Получение категорий (без использования getProductFromCRM)
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📦 Запрос категорий');

    const cacheKey = 'categories:all';
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Категории из кэша');
        res.json(JSON.parse(cached));
        return;
      }
    } catch (error) {
      console.warn('⚠️ Redis error:', error);
    }

    let categories: string[] = [];

    try {
      // ✅ ПРЯМОЙ ЗАПРОС К CRM
      const response = await axios.get(`${CRM_API_URL}/api/public/categories`, {
        timeout: 5000,
      });
      
      let data = response.data;
      
      // Нормализуем ответ
      if (Array.isArray(data)) {
        categories = data.map((c: any) => c.name || c).filter(Boolean);
      } else if (data.categories && Array.isArray(data.categories)) {
        categories = data.categories.map((c: any) => c.name || c).filter(Boolean);
      } else if (data.data && Array.isArray(data.data)) {
        categories = data.data.map((c: any) => c.name || c).filter(Boolean);
      } else if (data.items && Array.isArray(data.items)) {
        categories = data.items.map((c: any) => c.name || c).filter(Boolean);
      }
      
      console.log(`✅ Получено ${categories.length} категорий из CRM`);
    } catch (error: any) {
      console.warn('⚠️ CRM недоступна, получаем категории из товаров');
      
      // Fallback
      try {
        const productsResponse = await axios.get(`${CRM_API_URL}/api/public/products`, {
          params: { limit: 100 },
          timeout: 3000,
        });
        
        const products = productsResponse.data?.items || productsResponse.data || [];
        const uniqueCategories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
        categories = uniqueCategories;
        console.log(`✅ Получено ${categories.length} категорий из товаров`);
      } catch (fallbackError) {
        console.warn('⚠️ Не удалось получить категории');
        categories = [];
      }
    }

    const result = { categories };
    
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      console.warn('⚠️ Redis set error:', error);
    }

    res.json(result);
  } catch (error: any) {
    console.error('❌ Ошибка получения категорий:', error);
    res.json({ categories: [] });
  }
};

/**
 * GET /api/products/category/:category
 */
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    
    console.log(`📦 Запрос товаров по категории ${category} из CRM`);

    const response = await axios.get(`${CRM_API_URL}/api/public/products`, {
      params: { category },
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error: any) {
    console.error(`❌ Ошибка получения товаров по категории ${req.params.category}:`, error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
};