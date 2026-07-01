import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Получение корзины по userId или guestId
export const getCart = async (userId?: string, guestId?: string) => {
  if (!userId && !guestId) {
    throw new Error('Необходим userId или guestId');
  }

  let cart = await prisma.cart.findFirst({
    where: userId ? { userId } : { guestId },
  });

  if (!cart) {
    // Создаём новую корзину
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
  // Если нет userId и guestId - создаём guestId
  if (!userId && !guestId) {
    guestId = uuidv4();
  }

  const cart = await getCart(userId, guestId);
  
  // Преобразуем items в массив
  let items = Array.isArray(cart.items) ? cart.items : [];
  
  // Ищем существующий товар
  const existingIndex = items.findIndex((item: any) => item.productId === productId);
  
  if (existingIndex >= 0) {
    // Обновляем количество
    items[existingIndex].quantity += quantity;
  } else {
    // Добавляем новый товар
    items.push({
      productId,
      name: productName,
      price,
      quantity,
      image,
    });
  }

  // Обновляем корзину
  const updatedCart = await prisma.cart.update({
    where: { id: cart.id },
    data: { items },
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

  let items = Array.isArray(cart.items) ? cart.items : [];
  
  const itemIndex = items.findIndex((item: any) => item.productId === productId);
  if (itemIndex < 0) throw new Error('Товар не найден в корзине');

  if (quantity <= 0) {
    // Удаляем товар
    items.splice(itemIndex, 1);
  } else {
    // Обновляем количество
    items[itemIndex].quantity = quantity;
  }

  return await prisma.cart.update({
    where: { id: cartId },
    data: { items },
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
  const items = Array.isArray(cart.items) ? cart.items : [];
  
  const total = items.reduce((sum: number, item: any) => {
    return sum + (item.price * item.quantity);
  }, 0);

  return {
    ...cart,
    total,
    itemsCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
  };
};