import { Request, Response } from 'express';
import express from 'express';
import supertest from 'supertest';
import { validate } from '../../../src/middleware/validate.middleware';
import { createOrderSchema } from '../../../src/schemas/order.schema';
import { PrismaClient } from '@prisma/client';
import { offerAcceptance, personalDataAcceptance } from '../../helpers/consent';
import { createOrderController, deleteOrderController, getOrderController, getUserOrdersController } from '../../../src/controllers/order.controller';
import {
  CheckoutInventoryError,
  validateCheckoutItems,
} from '../../../src/services/checkoutInventory.service';

jest.mock('@prisma/client', () => {
  const prisma = {
    userConsent: { findUnique: jest.fn(), upsert: jest.fn() },
    cart: { findUnique: jest.fn(), update: jest.fn() },
    order: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    invoice: { create: jest.fn() },
    outboxEvent: { upsert: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
  return { PrismaClient: jest.fn(() => prisma) };
});

describe('retired physical order deletion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 405 and directs callers to cancellation without deleting history', async () => {
    const req = { params: { id: 'order-1' }, user: { id: 'user-1' } } as unknown as Request;
    const res = response();

    await deleteOrderController(req, res);

    expect(mockPrisma.order.deleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      cancellationEndpoint: '/api/orders/order-1/cancellation',
    }));
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
    offerAcceptance,
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

const bankBuyer = {
  buyerType: 'legal_entity', legalName: 'ООО Покупатель', inn: '7707083893', kpp: '770701001',
  legalAddress: 'Москва, улица Покупателя, 1', contactName: 'Иван Иванов', phone: '+79990000000', email: 'buyer@example.com',
};

describe('bank checkout request boundary', () => {
  it.each(['amount', 'total', 'paymentStatus', 'sellerSnapshot', 'invoiceNumber', 'paidAt'])(
    'rejects trusted server field %s', field => {
      expect(createOrderSchema.safeParse({ ...request().body, paymentMethod: 'bank_invoice', invoiceBuyer: bankBuyer, [field]: 'forged' }).success).toBe(false);
    },
  );
  it.each(['1', '12345678', '1234567890', '12345678x'])(
    'rejects invalid KPP %s before checkout', kpp => {
      expect(createOrderSchema.safeParse({ ...request().body, paymentMethod: 'bank_invoice', invoiceBuyer: { ...bankBuyer, kpp } }).success).toBe(false);
    },
  );
  it('requires bank buyer and rejects buyer fields on online checkout', () => {
    expect(createOrderSchema.safeParse({ ...request().body, paymentMethod: 'bank_invoice' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...request().body, paymentMethod: 'online', invoiceBuyer: bankBuyer }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...request().body, paymentMethod: 'bank_invoice', invoiceBuyer: bankBuyer }).success).toBe(true);
    expect(createOrderSchema.safeParse(request().body).success).toBe(true);
  });
});

describe('authoritative order payment responses', () => {
  beforeEach(() => jest.clearAllMocks());
  const bankOrder = {
    id: 'order-1', userId: 'user-1', status: 'pending', paymentMethod: 'bank_invoice', paymentAttempts: [],
    invoice: { id: 'invoice-1', orderId: 'order-1', amountMinor: 5000n, documentStatus: 'preparing', paymentStatus: 'unpaid' },
  };
  it('returns bank payment projection on detail immediately, without a second invoice request', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(bankOrder);
    const res = response();
    await getOrderController({ params: { id: 'order-1' }, user: { id: 'user-1' } } as any, res);
    expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order-1', userId: 'user-1' }, include: expect.objectContaining({ invoice: true }) }));
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.order.payment).toMatchObject({ paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', canPayOnline: false });
    expect(payload.order.invoice.amountMinor).toBe('5000');
    expect(() => JSON.stringify(payload)).not.toThrow();
  });
  it('list and detail use the same projection, preserving online and bank states', async () => {
    mockPrisma.order.findMany.mockResolvedValue([bankOrder, { ...bankOrder, id: 'online', paymentMethod: 'online', invoice: null }]);
    const res = response();
    await getUserOrdersController({ user: { id: 'user-1' } } as any, res);
    const orders = (res.json as jest.Mock).mock.calls[0][0].orders;
    expect(orders[0].payment.canPayOnline).toBe(false);
    expect(orders[1].payment).toMatchObject({ paymentMethod: 'online', canPayOnline: true });
  });
});

describe('createOrderController checkout validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.userConsent.findUnique.mockResolvedValue({ id: 'consent-1' });
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

  it('HTTP POST fails closed without offer/legacy PD, then succeeds with both acceptances', async () => {
    const app = express();
    app.use(express.json());
    // Auth itself has separate middleware coverage; this fixture is an authenticated legacy user.
    app.use((req, _res, next) => { (req as any).user = { id: 'user-1' }; next(); });
    app.post('/api/orders', validate(createOrderSchema), createOrderController);
    mockPrisma.userConsent.findUnique.mockResolvedValue(null);
    mockPrisma.userConsent.upsert.mockResolvedValue({ id: 'consent-1' });
    const body = request().body;
    const noOffer = { ...body };
    delete noOffer.offerAcceptance;
    const first = await supertest(app).post('/api/orders').send(noOffer);
    expect(first.status).toBe(400);
    expect(first.body.code).toBe('VALIDATION_ERROR');
    const second = await supertest(app).post('/api/orders').send(body);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('PERSONAL_DATA_CONSENT_REQUIRED');
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    const third = await supertest(app).post('/api/orders').send({ ...body, personalDataConsent: personalDataAcceptance });
    expect(third.status).toBe(201);
    expect(third.body.order.id).toBe('order-1');
  });

  it('stores the CRM snapshot and clears the cart atomically', async () => {
    const res = response();
    await createOrderController(request(), res);

    expect(mockedValidateCheckoutItems).toHaveBeenCalledWith(cart.items);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ items: validated.items, total: validated.total,
        offerVersion: offerAcceptance.documentVersion, offerAcceptedAt: expect.any(Date), personalDataConsentId: 'consent-1' }),
    }));
    expect(mockPrisma.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id }, data: { items: [] },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('persists bank intent, Invoice and durable intake in the checkout transaction without online customer mail', async () => {
    const req = request();
    req.body.paymentMethod = 'bank_invoice';
    req.body.invoiceBuyer = bankBuyer;
    mockPrisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'order-1', ...data }));
    mockPrisma.invoice.create.mockImplementation(async ({ data }: any) => ({
      id: 'invoice-1', documentStatus: 'preparing', paymentStatus: 'unpaid', currency: 'RUB', ...data,
    }));
    mockPrisma.outboxEvent.upsert.mockResolvedValue({ id: 'intake-1' });
    const res = response();
    await createOrderController(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentMethod: 'bank_invoice', total: 50 }) }));
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: 5000n, buyerSnapshot: bankBuyer }) });
    expect(mockPrisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ aggregateId: 'order-1', type: 'bank_invoice_intake_requested' }) }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ order: expect.objectContaining({
      paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', canPayOnline: false,
      payment: expect.objectContaining({ canPayOnline: false }), invoice: expect.objectContaining({ amountMinor: '5000' }),
    }) }));
    expect(require('../../../src/services/email.service').sendOrderCreatedToCustomer).not.toHaveBeenCalled();
  });

  it('rejects invalid bank buyer before touching the cart or creating an online order', async () => {
    const req = request();
    req.body.paymentMethod = 'bank_invoice';
    req.body.invoiceBuyer = { ...bankBuyer, kpp: '123' };
    const res = response();
    await createOrderController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(mockPrisma.cart.update).not.toHaveBeenCalled();
  });

  it('passes only the customer confirmation fields and authoritative item snapshot to email', async () => {
    await createOrderController(request(), response());
    const mail = require('../../../src/services/email.service');
    expect(mail.sendOrderCreatedToCustomer).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1', documentNumber: 'order-1', total: 50,
      items: [{ name: 'CRM товар', quantity: 2, price: 25, total: 50 }],
    }), mockPrisma);
    const payload = mail.sendOrderCreatedToCustomer.mock.calls[0][0];
    expect(payload).not.toHaveProperty('user');
    expect(payload).not.toHaveProperty('paymentAttempts');
    expect(payload).not.toHaveProperty('crmOrderId');
    expect(payload).toHaveProperty('createdAt');
    expect(payload).toHaveProperty('offerVersion');
    expect(payload).toHaveProperty('deliveryMethod');
  });

  it('requires fresh offer acceptance for every new order, even with stored PD consent', async () => {
    const req = request();
    delete req.body.offerAcceptance;
    const res = response();
    await createOrderController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'OFFER_ACCEPTANCE_REQUIRED' }));
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(mockPrisma.cart.update).not.toHaveBeenCalled();
  });

  it('rejects legacy checkout without PD acceptance before any side effects', async () => {
    mockPrisma.userConsent.findUnique.mockResolvedValue(null);
    const res = response();
    await createOrderController(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERSONAL_DATA_CONSENT_REQUIRED' }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('persists legacy consent in the same transaction as the linked order, then reuses it', async () => {
    let stored: any = null;
    let inTransaction = false;
    mockPrisma.userConsent.findUnique.mockImplementation(async () => stored);
    mockPrisma.userConsent.upsert.mockImplementation(async ({ create }: any) => {
      expect(inTransaction).toBe(true);
      stored = { id: 'legacy-consent', ...create };
      return stored;
    });
    mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
      inTransaction = true;
      try { return await callback(mockPrisma); } finally { inTransaction = false; }
    });
    const req = request();
    req.body.personalDataConsent = personalDataAcceptance;
    const first = response();
    await createOrderController(req, first);
    expect(first.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      personalDataConsentId: 'legacy-consent', offerVersion: offerAcceptance.documentVersion, offerAcceptedAt: expect.any(Date),
    }) }));
    expect(stored).toMatchObject({ userId: 'user-1', source: 'checkout', type: 'personal_data' });
    const next = response();
    await createOrderController(request(), next);
    expect(next.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.userConsent.upsert).toHaveBeenCalledTimes(1);
    const withoutOffer = request();
    delete withoutOffer.body.offerAcceptance;
    const denied = response();
    await createOrderController(withoutOffer, denied);
    expect(denied.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(2);
  });

  it('rechecks consent within the order transaction and refuses a disappeared consent', async () => {
    mockPrisma.userConsent.findUnique.mockResolvedValueOnce({ id: 'consent-1' }).mockResolvedValueOnce(null);
    const res = response();
    await createOrderController(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('does not create an order if transactional consent persistence fails', async () => {
    mockPrisma.userConsent.findUnique.mockResolvedValue(null);
    mockPrisma.userConsent.upsert.mockRejectedValueOnce(new Error('database unavailable'));
    const req = request();
    req.body.personalDataConsent = personalDataAcceptance;
    const res = response();
    await createOrderController(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORDER_CREATE_FAILED' }));
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(mockPrisma.cart.update).not.toHaveBeenCalled();
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
