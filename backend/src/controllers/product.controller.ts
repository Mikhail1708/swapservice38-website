// swapservice38-website/backend/src/controllers/product.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

// ============================================================
// НОРМАЛИЗАЦИЯ ТОВАРА
// ============================================================
const normalizeProduct = (item: any) => {
  let images: string[] = [];
  
  if (item.images && Array.isArray(item.images)) {
    images = item.images.filter(Boolean);
  }
  
  if (images.length === 0 && item.image_url) {
    images = [item.image_url];
  }
  
  if (images.length === 0) {
    images = ['/images/placeholder.jpg'];
  }

  return {
    id: item.id || item.productId,
    name: item.name || 'Товар',
    description: item.description || '',
    price: item.price || item.retail_price || 0,
    oldPrice: item.oldPrice || item.old_price || null,
    category: item.category || item.categories?.[0]?.name || '',
    categories: item.categories || [],
    inStock: item.inStock !== undefined ? item.inStock : (item.stock || 0) > 0,
    stock: item.stock || 0,
    sku: item.sku || item.article || '',
    images: images,
    image_url: images[0] || '',
    characteristics: item.characteristics || {},
    features: item.features || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    views: item.views || 0,
    ordersCount: item.ordersCount || 0,
    popularity: item.popularity || 0,
  };
};

// ============================================================
// НОРМАЛИЗАЦИЯ СПИСКА
// ============================================================
const normalizeProducts = (data: any) => {
  if (data.items && Array.isArray(data.items)) {
    return {
      ...data,
      items: data.items.map(normalizeProduct),
    };
  }
  if (Array.isArray(data)) {
    return data.map(normalizeProduct);
  }
  return data;
};

// ============================================================
// GET /api/products — БЕЗ КЕША!
// ============================================================
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = '1', limit = '16', sort } = req.query;
    
    console.log('📦 Запрос товаров из CRM (без кеша)');

    const response = await axios.get(`${CRM_API_URL}/api/public/products`, {
      params: { category, search, page, limit },
      timeout: 10000,
    });

    const normalizedData = normalizeProducts(response.data);
    
    console.log('✅ Товары получены из CRM');
    
    res.json(normalizedData);
  } catch (error: any) {
    console.error('❌ Ошибка получения товаров:', error);
    res.status(500).json({ 
      error: 'Ошибка получения товаров',
      details: error.message 
    });
  }
};

// ============================================================
// GET /api/products/:id — БЕЗ КЕША!
// ============================================================
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    console.log(`📦 Запрос товара ${id} из CRM (без кеша)`);

    const response = await axios.get(`${CRM_API_URL}/api/public/products/${id}`, {
      timeout: 10000,
    });

    const normalizedProduct = normalizeProduct(response.data);
    
    console.log(`✅ Товар ${id} получен из CRM`);

    res.json(normalizedProduct);
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

// ============================================================
// GET /api/products/categories — БЕЗ КЕША!
// ============================================================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📦 Запрос категорий из CRM (без кеша)');

    let categories: string[] = [];

    try {
      const response = await axios.get(`${CRM_API_URL}/api/public/categories`, {
        timeout: 5000,
      });
      
      let data = response.data;
      
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

    res.json({ categories });
  } catch (error: any) {
    console.error('❌ Ошибка получения категорий:', error);
    res.json({ categories: [] });
  }
};

// ============================================================
// GET /api/products/category/:category
// ============================================================
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;

    const response = await axios.get(`${CRM_API_URL}/api/public/products`, {
      params: { category },
      timeout: 10000,
    });

    const normalizedData = normalizeProducts(response.data);
    res.json(normalizedData);
  } catch (error: any) {
    console.error(`❌ Ошибка получения товаров по категории ${req.params.category}:`, error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
};