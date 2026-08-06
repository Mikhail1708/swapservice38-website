// backend/tests/unit/controllers/webhook.controller.test.ts
import { Request, Response } from 'express';
import { handleOrderStatusWebhook, webhookHealthCheck } from '../../../src/controllers/webhook.controller';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

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
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: 'paid' });

      const req = {
        body: {
          crmOrderId: '12345',
          status: 'paid',
          documentNumber: 'DOC-001',
        },
        headers: {
          'x-webhook-signature': 'test-signature',
        },
      } as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(mockPrisma.order.update).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 401 if signature missing', async () => {
      const req = {
        body: { crmOrderId: '12345', status: 'paid' },
        headers: {},
      } as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if required fields missing', async () => {
      const req = {
        body: { status: 'paid' },
        headers: { 'x-webhook-signature': 'test' },
      } as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const req = {
        body: {
          crmOrderId: '12345',
          status: 'paid',
        },
        headers: { 'x-webhook-signature': 'test-signature' },
      } as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await handleOrderStatusWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
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