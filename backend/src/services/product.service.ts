import axios from 'axios';
import redis from '../config/redis';

// Мок-данные (пока нет CRM)
const mockProducts = [
  {
    id: '1',
    name: 'Боди-лифт Nissan Patrol Y60',
    description: 'Комплект для поднятия кузова на 50мм',
    price: 15000,
    article: 'BL-NP-Y60',
    category: 'Боди-лифт',
    inStock: true,
    images: ['https://via.placeholder.com/300x200'],
    carModel: 'Nissan Patrol Y60',
  },
  {
    id: '2',
    name: 'Крепление канистры Toyota LC 80',
    description: 'Надёжное крепление для канистры на заднюю дверь',
    price: 8500,
    article: 'KC-TLC-80',
    category: 'Крепления',
    inStock: true,
    images: ['https://via.placeholder.com/300x200'],
    carModel: 'Toyota LC 80',
  },
  {
    id: '3',
    name: 'Защита картера Nissan Patrol Y61',
    description: 'Стальная защита двигателя 5мм',
    price: 12000,
    article: 'ZP-NP-Y61',
    category: 'Защита',
    inStock: false,
    images: ['https://via.placeholder.com/300x200'],
    carModel: 'Nissan Patrol Y61',
  },
];

// Получение всех товаров (с кэшированием)
export const getProducts = async (filters?: { category?: string; carModel?: string }) => {
  // Пробуем получить из кэша
  const cacheKey = `products:${JSON.stringify(filters || {})}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  // TODO: Заменить на реальный запрос к CRM
  // const response = await axios.get(`${process.env.CRM_API_URL}/api/public/products`, { params: filters });
  // const products = response.data;

  // Пока используем мок-данные с фильтрацией
  let products = mockProducts;
  
  if (filters?.category) {
    products = products.filter(p => p.category === filters.category);
  }
  if (filters?.carModel) {
    products = products.filter(p => p.carModel === filters.carModel);
  }

  // Сохраняем в кэш на 5 минут
  await redis.setex(cacheKey, 300, JSON.stringify(products));

  return products;
};

// Получение одного товара по ID
export const getProductById = async (id: string) => {
  // Пробуем из кэша
  const cacheKey = `product:${id}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  // TODO: Заменить на реальный запрос к CRM
  // const response = await axios.get(`${process.env.CRM_API_URL}/api/public/products/${id}`);
  // const product = response.data;

  // Пока из мок-данных
  const product = mockProducts.find(p => p.id === id);
  
  if (product) {
    await redis.setex(cacheKey, 300, JSON.stringify(product));
  }

  return product || null;
};