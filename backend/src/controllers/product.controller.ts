// backend/src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { getProductsFromCRM, getProductFromCRM } from '../services/crm.service';
import redis from '../config/redis';

// Мок-данные на случай, если CRM недоступна
const mockProducts = [
  {
    id: 1,
    name: 'Боди-лифт Nissan Patrol Y60',
    price: 15000,
    category: 'Боди-лифт',
    inStock: true,
    images: ['/images/products/bodylift-y60.jpg'],
    sku: 'BL-NP-Y60-001',
    description: 'Полный комплект для боди-лифта Nissan Patrol Y60'
  },
  {
    id: 2,
    name: 'Крепление канистры Toyota LC 80',
    price: 8500,
    category: 'Крепления',
    inStock: true,
    images: ['/images/products/canister-lc80.jpg'],
    sku: 'KC-TLC80-001',
    description: 'Крепление канистры на заднюю дверь Toyota LC 80'
  },
  {
    id: 3,
    name: 'Защита картера Nissan Patrol Y61',
    price: 12000,
    category: 'Защита',
    inStock: false,
    images: ['/images/products/sump-guard-y61.jpg'],
    sku: 'ZG-NPY61-001',
    description: 'Защита картера Nissan Patrol Y61'
  },
];

/**
 * GET /api/products
 * Получение списка товаров
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = '1', limit = '16' } = req.query;
    
    console.log('📦 Запрос товаров:', { category, search, page, limit });

    // Пытаемся получить из CRM
    try {
      const products = await getProductsFromCRM({ 
        category: category as string, 
        search: search as string 
      });
      
      res.json({
        products: products.data || products,
        total: products.total || products.length || 0,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      return;
    } catch (crmError) {
      console.warn('⚠️ CRM недоступна, возвращаем мок-данные');
      
      // Фильтруем мок-данные
      let filtered = [...mockProducts];
      
      if (category) {
        filtered = filtered.filter(p => 
          p.category.toLowerCase() === (category as string).toLowerCase()
        );
      }
      
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower)
        );
      }
      
      // Пагинация
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const end = start + limitNum;
      
      res.json({
        products: filtered.slice(start, end),
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
      });
    }
  } catch (error: any) {
    console.error('❌ Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
};

/**
 * GET /api/products/:id
 * Получение товара по ID
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    console.log(`📦 Запрос товара ${id}`);

    // Пытаемся получить из CRM
    try {
      const product = await getProductFromCRM(parseInt(id));
      res.json(product);
      return;
    } catch (crmError) {
      console.warn(`⚠️ CRM недоступна, ищем в мок-данных ${id}`);
      
      const product = mockProducts.find(p => p.id === parseInt(id));
      
      if (product) {
        res.json(product);
        return;
      }
      
      res.status(404).json({ error: 'Товар не найден' });
    }
  } catch (error: any) {
    console.error(`❌ Ошибка получения товара ${req.params.id}:`, error);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
};

/**
 * GET /api/products/categories
 * Получение всех категорий
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    // Пытаемся получить из CRM
    try {
      const categories = await getProductsFromCRM({});
      const uniqueCategories = [...new Set(categories.data?.map((p: any) => p.category) || [])];
      res.json({ categories: uniqueCategories });
      return;
    } catch (crmError) {
      // Мок-категории
      const categories = [...new Set(mockProducts.map(p => p.category))];
      res.json({ categories });
    }
  } catch (error: any) {
    console.error('❌ Ошибка получения категорий:', error);
    res.status(500).json({ error: 'Ошибка получения категорий' });
  }
};

/**
 * GET /api/products/category/:category
 * Получение товаров по категории
 */
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    
    console.log(`📦 Запрос товаров по категории: ${category}`);
    
    // Пытаемся получить из CRM
    try {
      const products = await getProductsFromCRM({ category });
      res.json({ products: products.data || products });
      return;
    } catch (crmError) {
      const filtered = mockProducts.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
      res.json({ products: filtered });
    }
  } catch (error: any) {
    console.error(`❌ Ошибка получения товаров по категории ${req.params.category}:`, error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
};