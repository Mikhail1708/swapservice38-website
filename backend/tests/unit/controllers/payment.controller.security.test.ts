import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  createPaymentController,
  confirmPaymentController,
  paymentWebhookController,
} from '../../../src/controllers/payment.controller';
import {
  createPayment,
  getPaymentStatus,
  handlePaymentSuccess,
  handlePaymentWebhook,
} from '../../../src/services/payment.service';
import { CheckoutInventoryError } from '../../../src/services/checkoutInventory.service';

jest.mock('@prisma/client', () => {
  const mockPrisma: any = {
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentAttempt: { updateMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  mockPrisma.$transaction = jest.fn((callback: Function) => callback(mockPrisma));
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

jest.mock('../../../src/services/payment.service', () => ({
  createPayment: jest.fn(),
  getPaymentStatus: jest.fn(),
  handlePaymentSuccess: jest.fn(),
  handlePaymentWebhook: jest.fn(),
  resendOrderToCRM: jest.fn(),
}));

const prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
const mockedCreatePayment = createPayment as jest.Mock;
const mockedGetPaymentStatus = getPaymentStatus as jest.Mock;
const mockedHandlePaymentSuccess = handlePaymentSuccess as jest.Mock;
const mockedHandlePaymentWebhook = handlePaymentWebhook as jest.Mock;

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
}) as unknown as Response;

const order = {
  id: 'order-1',
  userId: 'user-1',
  total: 1000,
  status: 'pending',
  paymentId: 'payment-1',
  crmOrderId: null,
  orderNumber: 'ORDER-1',
};

describe('Payment controller security checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the inventory status and code when payment creation is blocked', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    mockedCreatePayment.mockRejectedValue(new CheckoutInventoryError(
      'Недостаточно товара',
      409,
      'INSUFFICIENT_STOCK',
      { productId: '1', availableStock: 0, requestedQuantity: 1 },
    ));
    const req = {
      body: { orderId: order.id },
      user: { id: order.userId },
    } as unknown as Request;
    const res = createResponse();

    await createPaymentController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_STOCK',
      availableStock: 0,
    }));
  });

  it('does not confirm a synthetic test payment', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({ ...order, paymentId: 'test_1' });
    mockedGetPaymentStatus.mockResolvedValue({ status: 'pending' });
    const req = {
      body: { orderId: order.id, paymentId: 'test_1' },
      user: { id: order.userId },
    } as unknown as Request;
    const res = createResponse();

    await confirmPaymentController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedHandlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('confirms only a matching succeeded YooKassa payment', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    mockedGetPaymentStatus.mockResolvedValue({
      id: order.paymentId,
      status: 'succeeded',
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { orderId: order.id },
    });
    mockedHandlePaymentSuccess.mockResolvedValue({ success: true, status: 'paid' });
    const req = {
      body: { orderId: order.id, paymentId: order.paymentId },
      user: { id: order.userId },
    } as unknown as Request;
    const res = createResponse();

    await confirmPaymentController(req, res);

    expect(mockedHandlePaymentSuccess).toHaveBeenCalledWith(order.id);
    expect(res.json).toHaveBeenCalledWith({ success: true, status: 'paid' });
  });

  it('rejects a succeeded payment with a different amount', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    mockedGetPaymentStatus.mockResolvedValue({
      id: order.paymentId,
      status: 'succeeded',
      amount: { value: '1.00', currency: 'RUB' },
      metadata: { orderId: order.id },
    });
    const req = {
      body: { orderId: order.id, paymentId: order.paymentId },
      user: { id: order.userId },
    } as unknown as Request;
    const res = createResponse();

    await confirmPaymentController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedHandlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('rejects a payment that is not bound to the durable CRM reservation', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      ...order,
      paymentAttempts: [{
        providerPaymentId: order.paymentId,
        amountMinor: 100_000,
        currency: 'RUB',
        reservationId: 'reservation-1',
      }],
    });
    mockedGetPaymentStatus.mockResolvedValue({
      id: order.paymentId,
      status: 'succeeded',
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { orderId: order.id, reservationId: 'reservation-other' },
    });
    const req = {
      body: { orderId: order.id, paymentId: order.paymentId },
      user: { id: order.userId },
    } as unknown as Request;
    const res = createResponse();

    await confirmPaymentController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedHandlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('parses a raw webhook and verifies the payment through YooKassa', async () => {
    const notification = Buffer.from(JSON.stringify({ object: { id: order.paymentId } }));
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(order);
    const authoritativePayment = {
      id: order.paymentId,
      status: 'succeeded',
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { orderId: order.id },
    };
    mockedGetPaymentStatus.mockResolvedValue(authoritativePayment);
    mockedHandlePaymentWebhook.mockResolvedValue({ success: true, status: 'paid' });
    const req = { body: notification, headers: {} } as unknown as Request;
    const res = createResponse();

    await paymentWebhookController(req, res);

    expect(mockedGetPaymentStatus).toHaveBeenCalledWith(order.paymentId);
    expect(mockedHandlePaymentWebhook).toHaveBeenCalledWith({
      object: authoritativePayment,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, status: 'paid' });
  });

  it('recovers a provider payment created just before the local binding crashed', async () => {
    const unboundOrder = {
      ...order,
      paymentId: null,
      paymentAttempts: [{
        id: 'attempt-1', providerPaymentId: null, reservationId: 'reservation-1',
        amountMinor: 100_000, currency: 'RUB',
      }],
    };
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(unboundOrder);
    ((prisma as any).paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const authoritativePayment = {
      id: order.paymentId,
      status: 'succeeded',
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { orderId: order.id, reservationId: 'reservation-1' },
    };
    mockedGetPaymentStatus.mockResolvedValue(authoritativePayment);
    mockedHandlePaymentWebhook.mockResolvedValue({ success: true, status: 'paid' });
    const req = {
      body: Buffer.from(JSON.stringify({ object: { id: order.paymentId } })),
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await paymentWebhookController(req, res);

    expect((prisma as any).paymentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'attempt-1', providerPaymentId: null },
      data: expect.objectContaining({ providerPaymentId: order.paymentId }),
    }));
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: order.id, paymentId: null },
      data: { paymentId: order.paymentId },
    }));
    expect(mockedHandlePaymentWebhook).toHaveBeenCalled();
  });
});
