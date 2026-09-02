// backend/src/services/crm.service.ts
import axios from 'axios';
import redis from '../config/redis';
import { getInternalApiKey } from '../utils/internalApiKey';
import { log } from '../config/logger';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';

/**
 * Получение списка товаров из CRM
 */
export const getProductsFromCRM = async (filters?: { category?: string; search?: string }) => {
  const cacheKey = `crm:products:${JSON.stringify(filters || {})}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  try {
    const response = await axios.get(`${CRM_API_URL}/api/public/products`, { 
      params: filters,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Кэшируем на 5 минут
    await redis.setex(cacheKey, 300, JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    log.error('CRM product list request failed');
    throw new Error('Ошибка получения товаров из CRM');
  }
};

/**
 * Получение одного товара из CRM
 */
export const getProductFromCRM = async (productId: number) => {
  const cacheKey = `crm:product:${productId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  try {
    const response = await axios.get(`${CRM_API_URL}/api/public/products/${productId}`, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    await redis.setex(cacheKey, 300, JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    log.error('CRM product request failed');
    throw new Error('Ошибка получения товара из CRM');
  }
};

/**
 * Создание заказа в CRM
 */
export const createOrderInCRM = async (orderData: {
  items: Array<{ productId: number; quantity: number; price?: number }>;
  client: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    city?: string;
    address?: string;
  };
  deliveryMethod: string;
  deliveryAddress?: string;
  comment?: string;
  source?: string;
}) => {
  try {
    const url = `${CRM_API_URL}/api/sale-documents/public`;
    
    const response = await axios.post(url, orderData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getInternalApiKey(),
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error('Ошибка создания заказа в CRM');
    }
    throw new Error('Ошибка создания заказа в CRM');
  }
};

/**
 * Получение статуса заказа из CRM
 */
export const getOrderStatusFromCRM = async (orderId: number) => {
  try {
    const response = await axios.get(`${CRM_API_URL}/api/sale-documents/${orderId}/status`, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    log.error('CRM order status request failed');
    throw new Error('Ошибка получения статуса заказа');
  }
};

/**
 * Проверка доступности CRM
 */
export const checkCRMHealth = async () => {
  try {
    const response = await axios.get(`${CRM_API_URL}/api/health`, {
      timeout: 3000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};
