import { Request, Response } from 'express';
import { addToCart, getCart, getCartWithTotal, updateCartItem, clearCart } from '../services/cart.service';
import { v4 as uuidv4 } from 'uuid';

// Добавление в корзину
export const addToCartController = async (req: Request, res: Response) => {
  try {
    const { productId, productName, price, quantity, image } = req.body;
    const userId = (req as any).user?.id;
    
    // Если нет userId - генерируем guestId из cookie или создаём новый
    let guestId = req.cookies?.guestId;
    if (!userId && !guestId) {
      guestId = uuidv4();
      res.cookie('guestId', guestId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    const cart = await addToCart(
      productId,
      productName,
      price,
      quantity || 1,
      image,
      userId,
      guestId
    );

    // Если гость - отправляем guestId в cookie
    if (!userId && guestId) {
      res.cookie('guestId', guestId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    res.json({ cart: await getCartWithTotal(userId, guestId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Получение корзины
export const getCartController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    // Если нет userId и guestId - создаём guestId
    if (!userId && !guestId) {
      guestId = uuidv4();
      res.cookie('guestId', guestId, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    const cart = await getCartWithTotal(userId, guestId);
    res.json({ cart });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Обновление товара в корзине
export const updateCartItemController = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;
    const userId = (req as any).user?.id;
    let guestId = req.cookies?.guestId;

    if (!userId && !guestId) {
      guestId = uuidv4();
      res.cookie('guestId', guestId, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    const cart = await getCart(userId, guestId);
    const updated = await updateCartItem(cart.id, productId, quantity);

    res.json({ cart: await getCartWithTotal(userId, guestId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Очистка корзины
export const clearCartController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const guestId = req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.status(400).json({ error: 'Корзина не найдена' });
    }

    const cart = await getCart(userId, guestId);
    await clearCart(cart.id);

    res.json({ message: 'Корзина очищена' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};