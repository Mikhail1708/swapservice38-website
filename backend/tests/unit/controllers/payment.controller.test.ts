import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createPaymentController, getPaymentStatusController } from '../../../src/controllers/payment.controller';
import { createPayment, getPaymentStatus } from '../../../src/services/payment.service';

jest.mock('../../../src/services/payment.service', () => ({
  getPaymentStatus: jest.fn(),
  createPayment: jest.fn(),
  handlePaymentSuccess: jest.fn(),
  handlePaymentWebhook: jest.fn(),
  resendOrderToCRM: jest.fn(),
  completeMockPayment: jest.fn(),
  getPaymentProvider: jest.fn().mockReturnValue('mock'),
}));

const prisma = new PrismaClient() as any;
const response = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('payment status ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not call the provider for a payment not owned by the current user', async () => {
    prisma.paymentAttempt.findFirst.mockResolvedValueOnce(null);
    const req = { params: { paymentId: 'provider-payment' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await getPaymentStatusController(req, res);

    expect(prisma.paymentAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { providerPaymentId: 'provider-payment', order: { userId: 'user-1' } },
    }));
    expect(getPaymentStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns only a minimal provider status projection to the owner', async () => {
    prisma.paymentAttempt.findFirst.mockResolvedValueOnce({ providerPaymentId: 'provider-payment' });
    (getPaymentStatus as jest.Mock).mockResolvedValueOnce({
      id: 'provider-payment', status: 'pending', paid: false, metadata: { internal: 'secret' },
    });
    const req = { params: { paymentId: 'provider-payment' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await getPaymentStatusController(req, res);

    expect(res.json).toHaveBeenCalledWith({ paymentId: 'provider-payment', status: 'pending', paid: false });
  });
});

describe('payment creation truth source', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not treat CRM confirmed fulfillment as proof of payment', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({
      id: 'order-1', userId: 'user-1', status: 'confirmed', paymentAttempts: [],
    });
    (createPayment as jest.Mock).mockResolvedValueOnce({ paymentId: 'payment-1', paymentUrl: 'https://yookassa.ru/pay', status: 'pending' });
    const req = { body: { orderId: 'order-1' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await createPaymentController(req, res);

    expect(createPayment).toHaveBeenCalledWith('order-1', expect.stringContaining('/payment/success?orderId=order-1'));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'payment-1', status: 'pending' }));
  });

  it('uses the latest durable succeeded attempt as payment truth', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({
      id: 'order-1', userId: 'user-1', status: 'confirmed', paymentAttempts: [{ status: 'succeeded' }],
    });
    const req = { body: { orderId: 'order-1' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await createPaymentController(req, res);

    expect(createPayment).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'already_paid', status: 'paid' }));
  });
});
