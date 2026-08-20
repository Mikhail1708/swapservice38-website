import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createOrderController, deleteOrderController } from '../../../src/controllers/order.controller';
import {
  CheckoutInventoryError,
  validateCheckoutItems,
} from '../../../src/services/checkoutInventory.service';

jest.mock('@prisma/client', () => {
  const prisma = {
    cart: { findUnique: jest.fn(), update: jest.fn() },
    order: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
  return { PrismaClient: jest.fn(() => prisma) };
});

describe('deleteOrderController payment barrier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses an atomic delete predicate that rejects every started payment attempt', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'order-1', userId: 'user-1', status: 'pending', crmOrderId: null,
      paymentId: null, createdAt: new Date(),
    });
    mockPrisma.order.deleteMany.mockResolvedValue({ count: 0 });
    const req = { params: { id: 'order-1' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await deleteOrderController(req, res);

    expect(mockPrisma.order.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'order-1', userId: 'user-1', paymentId: null,
        paymentAttempts: { none: {} },
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
jest.mock('../../../src/services/checkoutInventory.service', () => {
  const actual = jest.requireActual('../../../src/services/checkoutInventory.service');
  return { ...actual, validateCheckoutItems: jest.fn() };
});

const mockedValidateCheckoutItems = validateCheckoutItems as jest.Mock;
const mockPrisma = new PrismaClient() as any;
const request = () => ({
  body: {
    client: {
      firstName: 'Иван', lastName: 'Иванов',
      phone: '+79990000000', email: 'ivan@example.com',
    },
    deliveryMethod: 'pickup', contactMethod: 'phone',
  },
  query: {}, cookies: {}, user: { id: 'user-1' },
}) as unknown as Request;
const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  clearCookie: jest.fn().mockReturnThis(),
}) as unknown as Response;

const cart = {
  id: 'cart-1', userId: 'user-1',
  items: [{ productId: '1', name: 'Старое имя', price: 10, quantity: 2 }],
};
const validated = {
  items: [{ productId: '1', name: 'CRM товар', price: 25, quantity: 2, maxStock: 5 }],
  total: 50,
};

describe('createOrderController checkout validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.cart.findUnique.mockResolvedValue(cart);
    mockPrisma.cart.update.mockResolvedValue({ ...cart, items: [] });
    mockPrisma.order.create.mockResolvedValue({
      id: 'order-1', status: 'pending', total: validated.total,
      customerFirstName: 'Иван', customerMiddleName: null, customerLastName: 'Иванов',
      customerEmail: 'ivan@example.com', customerPhone: '+79990000000',
      deliveryAddress: null, comment: null,
    });
    mockedValidateCheckoutItems.mockResolvedValue(validated);
  });

  it('stores the CRM snapshot and clears the cart atomically', async () => {
    const res = response();
    await createOrderController(request(), res);

    expect(mockedValidateCheckoutItems).toHaveBeenCalledWith(cart.items);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ items: validated.items, total: validated.total }),
    }));
    expect(mockPrisma.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id }, data: { items: [] },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('has no side effects when stock validation fails', async () => {
    mockedValidateCheckoutItems.mockRejectedValue(new CheckoutInventoryError(
      'Недостаточно товара', 409, 'INSUFFICIENT_STOCK',
      { productId: '1', availableStock: 1, requestedQuantity: 2 },
    ));
    const res = response();
    await createOrderController(request(), res);

    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(mockPrisma.cart.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }));
  });

  it('rejects a cart changed during validation', async () => {
    mockPrisma.cart.findUnique
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce({ ...cart, items: [] });
    const res = response();
    await createOrderController(request(), res);

    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CART_CHANGED' }));
  });

  it('retries a Prisma serializable conflict once', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    const res = response();
    await createOrderController(request(), res);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
