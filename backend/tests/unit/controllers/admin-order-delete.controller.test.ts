import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import {
  deleteOrder,
  massDeleteOrders,
} from '../../../src/controllers/admin/orders.controller';
import { asyncHandler } from '../../../src/middleware/async.middleware';
import { errorHandler } from '../../../src/middleware/error.middleware';

const mockPrisma = new PrismaClient() as any;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-1', role: 'admin' };
    next();
  });
  app.delete('/api/admin/orders/:id', asyncHandler(deleteOrder));
  app.post('/api/admin/orders/mass-delete', asyncHandler(massDeleteOrders));
  app.use(errorHandler);
  return app;
};

describe('admin order deletion error contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'pending' });
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('returns the payment-started AppError as HTTP 409 and keeps serving requests', async () => {
    mockPrisma.order.deleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const app = createApp();

    const blocked = await request(app).delete('/api/admin/orders/order-1');
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({
      success: false,
      error: 'Нельзя удалить заказ после начала оплаты',
    });

    const allowedAfterError = await request(app).delete('/api/admin/orders/order-2');
    expect(allowedAfterError.status).toBe(200);
    expect(allowedAfterError.body).toEqual({ success: true, message: 'Заказ удалён' });
  });

  it('deletes an order when payment has not started', async () => {
    mockPrisma.order.deleteMany.mockResolvedValueOnce({ count: 1 });

    const response = await request(createApp()).delete('/api/admin/orders/order-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockPrisma.order.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        paymentId: null,
        paymentAttempts: { none: {} },
      },
    });
  });

  it('reports payment-started orders skipped by mass delete instead of silent deleted: 0', async () => {
    mockPrisma.order.findMany.mockResolvedValueOnce([
      {
        id: 'blocked-order',
        status: 'pending',
        paymentId: 'provider-payment-id',
        paymentAttempts: [],
      },
    ]);

    const response = await request(createApp())
      .post('/api/admin/orders/mass-delete')
      .send({ ids: ['blocked-order'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: false,
      deleted: 0,
      skipped: [{
        id: 'blocked-order',
        code: 'PAYMENT_STARTED',
        reason: 'Нельзя удалить заказ после начала оплаты',
      }],
      message: 'Удалено 0 заказов, пропущено 1',
    });
    expect(mockPrisma.order.deleteMany).not.toHaveBeenCalled();
  });
});
