// backend/tests/unit/controllers/cart.controller.test.ts
import { Request, Response } from 'express';
import {
  getCart,
  addToCart,
  updateCart,
  clearCart,
} from '../../../src/controllers/cart.controller';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

const mockRequest = (body: any = {}, user: any = null, cookies: any = {}): Partial<Request> => {
  const req: Partial<Request> = {
    body,
    cookies,
    headers: {},
  };
  if (user) {
    (req as any).user = user;
  }
  return req;
};

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('Cart Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return cart for authenticated user', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({}, user);
      const res = mockResponse();

      const mockPrisma = {
        cart: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [],
          }),
          create: jest.fn(),
          delete: jest.fn(),
        },
      };
      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      await getCart(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });

    it('should create guest cart', async () => {
      const req = mockRequest({}, null, {});
      const res = mockResponse();

      const mockPrisma = {
        cart: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'cart-new',
            items: [],
          }),
        },
      };
      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      await getCart(req as Request, res as Response);

      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('addToCart', () => {
    it('should add item to cart', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({ productId: '1', quantity: 2 }, user);
      const res = mockResponse();

      const mockPrisma = {
        cart: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [],
          }),
          update: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [{ productId: '1', quantity: 2 }],
          }),
          create: jest.fn(),
        },
      };
      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      // Мокаем fetch для получения товара из CRM
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Product 1',
          price: 100,
          stock: 10,
          images: [],
        }),
      });

      await addToCart(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if product not found', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({ productId: '999' }, user);
      const res = mockResponse();

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      });

      await addToCart(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if product out of stock', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({ productId: '1', quantity: 5 }, user);
      const res = mockResponse();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Product 1',
          price: 100,
          stock: 2,
          images: [],
        }),
      });

      await addToCart(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateCart', () => {
    it('should update cart item quantity', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({ productId: '1', quantity: 3 }, user);
      const res = mockResponse();

      const mockPrisma = {
        cart: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [{ productId: '1', quantity: 2 }],
          }),
          update: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [{ productId: '1', quantity: 3 }],
          }),
        },
      };
      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          stock: 10,
        }),
      });

      await updateCart(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('should clear cart', async () => {
      const user = { id: 'user-1' };
      const req = mockRequest({}, user);
      const res = mockResponse();

      const mockPrisma = {
        cart: {
          update: jest.fn().mockResolvedValue({
            id: 'cart-1',
            items: [],
          }),
        },
      };
      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      await clearCart(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 401 if no user and no guestId', async () => {
      const req = mockRequest({}, null, {});
      const res = mockResponse();

      await clearCart(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});