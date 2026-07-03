// backend/src/services/order.service.ts (САЙТ)
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// ============================================================
// ПОЛУЧЕНИЕ КОРЗИНЫ
// ============================================================
export const getCartWithTotal = async (userId?: string, guestId?: string) => {
  let cart = null;
  
  if (userId) {
    cart = await prisma.cart.findUnique({
      where: { userId: String(userId) },
    });
  } else if (guestId) {
    cart = await prisma.cart.findUnique({
      where: { guestId: guestId },
    });
  }

  if (!cart) {
    return { id: null, items: [], total: 0, itemsCount: 0 };
  }

  const items = (cart.items as any[]) || [];
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    id: cart.id,
    items: items,
    total: total,
    itemsCount: itemsCount,
  };
};

// ============================================================
// ОЧИСТКА КОРЗИНЫ
// ============================================================
export const clearCart = async (cartId: string) => {
  return prisma.cart.update({
    where: { id: cartId },
    data: { items: [] },
  });
};

// ============================================================
// СОЗДАНИЕ ЗАКАЗА В CRM
// ============================================================
export const createOrderInCRM = async (orderData: any) => {
  const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
  const url = `${CRM_API_URL}/api/sale-documents/public`;
  
  console.log('🌐 Отправка в CRM:', url);
  
  try {
    const response = await axios.post(url, orderData, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Ответ CRM:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Ошибка создания заказа в CRM:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('📦 Статус:', error.response.status);
      console.error('📦 Ответ:', error.response.data);
      throw new Error(error.response.data?.message || 'Ошибка создания заказа в CRM');
    }
    throw new Error('Ошибка создания заказа в CRM');
  }
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ЗАКАЗА ИЗ CRM
// ============================================================
export const getOrderStatusFromCRM = async (crmOrderId: number) => {
  const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
  
  try {
    const response = await axios.get(
      `${CRM_API_URL}/api/sale-documents/${crmOrderId}/status`,
      { timeout: 5000 }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка получения статуса заказа ${crmOrderId}:`, error);
    return { orderStatus: 'unknown' };
  }
};