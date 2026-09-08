import { Request, Response } from 'express';
import axios from 'axios';
import mockPrisma from '../../__mocks__/@prisma/client';
import { addToCart, updateCart } from '../../../src/controllers/cart.controller';
import { getProducts, getProductById } from '../../../src/controllers/product.controller';
import { productAvailability } from '../../../src/utils/productAvailability';

jest.mock('axios');
const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
};
describe('CRM free-stock availability contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart', items: [{ productId: '1', quantity: 1 }] } as any);
    mockPrisma.cart.update.mockImplementation(async (args: any) => ({ id: 'cart', items: args.data.items }));
  });
  it.each([0, 3])('preserves stock %i products in list and detail responses', async stock => {
    const product = { id: 1, name: 'Product', stock };
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: { items: [product], total: 1 } });
    const list = response();
    await getProducts({ query: {} } as Request, list);
    expect(list.json).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining(productAvailability(product))] }));
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: product });
    const detail = response();
    await getProductById({ params: { id: '1' } } as any, detail);
    expect(detail.json).toHaveBeenCalledWith(expect.objectContaining(productAvailability(product)));
  });
  it('uses CRM free stock even when raw stock differs; fully reserved is on_order', () => {
    expect(productAvailability({ stock: 8, availableStock: 0 })).toMatchObject({ availabilityStatus: 'on_order', inStock: false, stock: 0 });
  });
  it.each([addToCart, updateCart])('rejects adding/updating an on-order item without cart writes', async handler => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, stock: 8, availableStock: 0 }) });
    const res = response();
    await handler({ body: { productId: '1', quantity: 1 }, user: { id: 'user' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.cart.update).not.toHaveBeenCalled();
    expect(mockPrisma.cart.create).not.toHaveBeenCalled();
  });
  it('allows an in-stock product within the free-stock limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Product', price: 100, stock: 3 }) });
    const res = response();
    await addToCart({ body: { productId: '1', quantity: 1 }, user: { id: 'user' } } as any, res);
    expect(mockPrisma.cart.update).toHaveBeenCalledWith(expect.objectContaining({ data: { items: [expect.objectContaining({ quantity: 2 })] } }));
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});
