// backend/src/services/cart.service.ts
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ✅ ТИП ДЛЯ ЭЛЕМЕНТА КОРЗИНЫ
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// ✅ БЕЗОПАСНОЕ ПРИВЕДЕНИЕ С ОБРАБОТКОЙ ОШИБОК
const safeItems = (items: any): CartItem[] => {
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.filter((item: any) => 
      item && typeof item === 'object' && 
      'productId' in item && 
      'quantity' in item &&
      'name' in item &&
      'price' in item
    ) as CartItem[];
  }
  return [];
};

// Получение корзины по userId или guestId
export const getCart = async (userId?: string, guestId?: string) => {
  if (!userId && !guestId) {
    throw new Error('Необходим userId или guestId');
  }

  let cart = await prisma.cart.findFirst({
    where: userId ? { userId } : { guestId },
  });

  if (!cart) {
    const newGuestId = guestId || uuidv4();
    cart = await prisma.cart.create({
      data: {
        userId: userId || null,
        guestId: newGuestId,
        items: [],
      },
    });
  }

  return cart;
};

// Добавление товара в корзину
export const addToCart = async (
  productId: string,
  productName: string,
  price: number,
  quantity: number = 1,
  image?: string,
  userId?: string,
  guestId?: string
) => {
  if (!userId && !guestId) {
    guestId = uuidv4();
  }

  const cart = await getCart(userId, guestId);
  
  // ✅ БЕЗОПАСНОЕ ПРИВЕДЕНИЕ
  let items = safeItems(cart.items);
  
  const existingIndex = items.findIndex((item: CartItem) => item.productId === productId);
  
  if (existingIndex >= 0) {
    // ✅ УВЕРЕНЫ, ЧТО ЭТО CartItem
    items[existingIndex].quantity += quantity;
  } else {
    items.push({
      productId,
      name: productName,
      price,
      quantity,
      image,
    });
  }

  const updatedCart = await prisma.cart.update({
    where: { id: cart.id },
    data: { items: items as any },
  });

  return updatedCart;
};

// Обновление количества товара в корзине
export const updateCartItem = async (
  cartId: string,
  productId: string,
  quantity: number
) => {
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) throw new Error('Корзина не найдена');

  let items = safeItems(cart.items);
  
  const itemIndex = items.findIndex((item: CartItem) => item.productId === productId);
  if (itemIndex < 0) throw new Error('Товар не найден в корзине');

  if (quantity <= 0) {
    items.splice(itemIndex, 1);
  } else {
    // ✅ УВЕРЕНЫ, ЧТО ЭТО CartItem
    items[itemIndex].quantity = quantity;
  }

  return await prisma.cart.update({
    where: { id: cartId },
    data: { items: items as any },
  });
};

// Очистка корзины
export const clearCart = async (cartId: string) => {
  return await prisma.cart.update({
    where: { id: cartId },
    data: { items: [] },
  });
};

// Получение корзины с подсчётом суммы
export const getCartWithTotal = async (userId?: string, guestId?: string) => {
  const cart = await getCart(userId, guestId);
  const items = safeItems(cart.items);
  
  const total = items.reduce((sum: number, item: CartItem) => {
    return sum + (item.price * item.quantity);
  }, 0);

  return {
    ...cart,
    total,
    itemsCount: items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
  };
};