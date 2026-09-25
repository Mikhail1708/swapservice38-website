// backend/tests/unit/controllers/webhook.controller.test.ts
import { Request, Response } from 'express';
import { handleOrderStatusWebhook, webhookHealthCheck } from '../../../src/controllers/webhook.controller';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendOrderStatusUpdateToCustomer } from '../../../src/services/email.service';

jest.mock('@prisma/client', () => {
  const mockPrisma: any = {
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    paymentAttempt: { findUnique: jest.fn(), update: jest.fn() },
    outboxEvent: { upsert: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    Prisma: {},
  };
});

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

const signPayload = (payload: Record<string, unknown>, secret = 'test-secret') => {
  const sortedPayload = Object.keys(payload).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = payload[key];
    return result;
  }, {});
  return crypto.createHmac('sha256', secret).update(JSON.stringify(sortedPayload)).digest('hex');
};

describe('Webhook Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_SECRET = 'test-secret';
  });

  describe('handleOrderStatusWebhook', () => {
    it('should update order status from CRM webhook', async () => {
      const mockOrder = {
        id: 'order-1',
        crmOrderId: '12345',
        status: 'pending',
        crmStatusVersion: 0,
        customerFirstName: 'Иван',
        customerLastName: 'Иванов',
        customerMiddleName: null,
        customerEmail: 'ivan@example.com',
        guestName: null,
        guestEmail: null,
        orderNumber: 'DOC-001',
      };

      (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'paid', crmStatusVersion: 1 });
      ((mockPrisma as any).paymentAttempt.findUnique as jest.Mock).mockResolvedValue(null);

      const payload = {
          crmOrderId: '12345',
          status: 'paid',
          documentNumber: 'DOC-001',
          version: 1,
      };
      const req = {
        body: payload,
        headers: {
          'x-webhook-signature': signPayload(payload),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(mockPrisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'paid', crmStatusVersion: 1 }),
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(sendOrderStatusUpdateToCustomer).toHaveBeenCalledTimes(1);
    });

    it('should return 401 if signature missing', async () => {
      const req = {
        body: { crmOrderId: '12345', status: 'paid' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if required fields missing', async () => {
      const payload = { status: 'paid' };
      const req = {
        body: payload,
        headers: { 'x-webhook-signature': signPayload(payload) },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle order not found', async () => {
      (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const payload = {
          crmOrderId: '12345',
          status: 'paid',
          version: 1,
      };
      const req = {
        body: payload,
        headers: { 'x-webhook-signature': signPayload(payload) },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should fail closed if webhook secret is missing', async () => {
      delete process.env.WEBHOOK_SECRET;
      const req = {
        body: { crmOrderId: '12345', status: 'paid' },
        headers: { 'x-webhook-signature': 'signature' },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('should reject an unknown order status', async () => {
      const payload = { crmOrderId: '12345', status: 'hacked-status', version: 1 };
      const req = {
        body: payload,
        headers: { 'x-webhook-signature': signPayload(payload) },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('ignores a replayed or stale CRM status version', async () => {
      const mockOrder = {
        id: 'order-1',
        crmOrderId: '12345',
        status: 'shipped',
        crmStatusVersion: 4,
      };
      (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      const payload = { crmOrderId: '12345', status: 'assembling', version: 3 };
      const req = {
        body: payload,
        headers: { 'x-webhook-signature': signPayload(payload) },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(sendOrderStatusUpdateToCustomer).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('atomically creates a deterministic refund intent for authoritative CRM cancellation', async () => {
      const current = {
        id: 'order-1', crmOrderId: '12345', status: 'assembling', crmStatusVersion: 1,
        cancellationState: 'requested', customerEmail: 'ivan@example.com',
      };
      (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(current);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(current);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({
        ...current, status: 'cancelled', crmStatusVersion: 2, cancellationState: 'accepted',
      });
      ((mockPrisma as any).paymentAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'attempt-1', providerPaymentId: 'payment-1', status: 'succeeded',
        amountMinor: 10_000, currency: 'RUB', refundRequestedAt: null,
      });
      ((mockPrisma as any).outboxEvent.upsert as jest.Mock).mockResolvedValue({ id: 'refund-event' });

      const payload = { crmOrderId: '12345', status: 'cancelled', version: 2 };
      const req = {
        body: payload,
        headers: { 'x-webhook-signature': signPayload(payload) },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect((mockPrisma as any).paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'refund_required', refundReason: 'post_handoff_cancellation' }),
      }));
      expect((mockPrisma as any).outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { deduplicationKey: 'payment-refund:payment-1' },
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('authoritative CRM manual reversals', () => {
    let order: any;
    let attempt: any;
    const deliver = async (status: string, version: unknown, signature?: string) => {
      const payload = { crmOrderId: '12345', status, version };
      const req = { body: payload, headers: { 'x-webhook-signature': signature ?? signPayload(payload) } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      await handleOrderStatusWebhook(req, res);
      return res;
    };
    beforeEach(() => {
      order = { id: 'order-1', crmOrderId: '12345', status: 'shipped', crmStatusVersion: 5,
        cancellationState: 'none', customerEmail: 'fixture@example.test' };
      attempt = null;
      (mockPrisma.order.findFirst as jest.Mock).mockImplementation(async () => ({ ...order }));
      (mockPrisma.order.findUnique as jest.Mock).mockImplementation(async () => ({ ...order }));
      (mockPrisma.order.update as jest.Mock).mockImplementation(async ({ data }) => {
        order = { ...order, ...data }; return { ...order };
      });
      ((mockPrisma as any).paymentAttempt.findUnique as jest.Mock).mockImplementation(async () => attempt && { ...attempt });
      ((mockPrisma as any).paymentAttempt.update as jest.Mock).mockImplementation(async ({ data }) => {
        attempt = { ...attempt, ...data }; return { ...attempt };
      });
    });
    const statuses = ['confirmed', 'assembling', 'shipped', 'cancelled'];
    it.each(statuses.flatMap(from => statuses.filter(to => to !== from).map(to => [from, to])))
    ('accepts signed newer %s -> %s without local workflow restrictions', async (from, to) => {
      order.status = from;
      const res = await deliver(to, 6);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(order.status).toBe(to);
      expect(order.crmStatusVersion).toBe(6);
      expect(mockPrisma.order.update).toHaveBeenCalledTimes(1);
      expect((mockPrisma as any).$queryRaw.mock.invocationCallOrder[0])
        .toBeLessThan((mockPrisma.order.findUnique as jest.Mock).mock.invocationCallOrder[0]);
      expect(sendOrderStatusUpdateToCustomer).toHaveBeenCalledWith(expect.objectContaining({ status: to, version: 6 }), mockPrisma);
      expect((mockPrisma as any).paymentAttempt.update).not.toHaveBeenCalled();
      expect((mockPrisma as any).outboxEvent.upsert).not.toHaveBeenCalled();
    });
    it('closes requested cancellation and preserves one existing refund intent through replay and reopening', async () => {
      order.cancellationState = 'requested';
      attempt = { id: 'attempt-1', providerPaymentId: 'payment-1', status: 'succeeded',
        amountMinor: 10000, currency: 'RUB', refundRequestedAt: null };
      expect((await deliver('cancelled', 6)).status).toHaveBeenCalledWith(200);
      expect(order).toEqual(expect.objectContaining({ status: 'cancelled', crmStatusVersion: 6,
        cancellationState: 'accepted', cancellationResolvedAt: expect.any(Date),
        cancellationDecisionReason: 'authoritative_crm_cancelled' }));
      for (const [status, version] of [['cancelled', 6], ['shipped', 5]] as const) {
        const replay = await deliver(status, version);
        expect(replay.json).toHaveBeenCalledWith(expect.objectContaining({ idempotent: true }));
        expect(order.status).toBe('cancelled');
        expect(order.crmStatusVersion).toBe(6);
      }
      expect((await deliver('assembling', 7)).status).toHaveBeenCalledWith(200);
      await deliver('cancelled', 6);
      expect(order.status).toBe('assembling');
      expect(order.crmStatusVersion).toBe(7);
      expect(mockPrisma.order.update).toHaveBeenCalledTimes(2);
      expect(sendOrderStatusUpdateToCustomer).toHaveBeenCalledTimes(2);
      expect((mockPrisma as any).paymentAttempt.update).toHaveBeenCalledTimes(1);
      expect((mockPrisma as any).outboxEvent.upsert).toHaveBeenCalledTimes(1);
      expect((mockPrisma as any).outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { deduplicationKey: 'payment-refund:payment-1' }, update: {},
      }));
      expect(attempt.status).toBe('refund_required');
    });
    it.each([undefined, null, -1, 1.5, '6'])('rejects missing/invalid version %s before mutation', async version => {
      expect((await deliver('cancelled', version)).status).toHaveBeenCalledWith(400);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
    it('rejects a bad signature before applying a reversal', async () => {
      expect((await deliver('cancelled', 6, 'invalid')).status).toHaveBeenCalledWith(401);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
    it('rejects unknown status even with a newer signed version', async () => {
      expect((await deliver('unknown', 6)).status).toHaveBeenCalledWith(400);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('webhookHealthCheck', () => {
    it('should return health status', async () => {
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await webhookHealthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          service: 'crm-webhook-receiver',
        })
      );
    });
  });
});
