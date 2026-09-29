import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { createPayment, handlePaymentWebhook } from '../../../src/services/payment.service';
import { buildInvoiceItemsSnapshot, invoiceAmountMinor } from '../../../src/services/invoice.service';
import { ensureCrmReservation, getOrCreatePaymentAttempt } from '../../../src/services/paymentAttempt.service';

jest.mock('../../../src/services/checkoutInventory.service', () => ({
  assertCheckoutSnapshotStillCurrent: jest.fn().mockResolvedValue(undefined),
  CheckoutInventoryError: class extends Error {},
}));
jest.mock('../../../src/services/paymentAttempt.service', () => {
  const actual = jest.requireActual('../../../src/services/paymentAttempt.service');
  return { ...actual, ensureCrmReservation: jest.fn(), getOrCreatePaymentAttempt: jest.fn() };
});

const db = new PrismaClient() as any;
const issued = { documentStatus: 'issued', paymentStatus: 'unpaid' };
const order = { id: 'invoice-order', status: 'pending', paymentMethod: 'online', total: 10,
  paymentId: null, cancellationState: 'none', invoice: null,
  items: [{ productId: '1', name: 'Part', price: 10, quantity: 1 }] };
const attempt = { id: 'invoice-attempt', orderId: order.id, amountMinor: 1000,
  currency: 'RUB', status: 'initiating', reservationId: 'invoice-reserve', providerPaymentId: null };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PAYMENT_PROVIDER = 'mock';
  db.$transaction.mockImplementation((run: any) => run(db));
  db.$queryRaw.mockResolvedValue([]);
  db.order.findUnique.mockReset().mockResolvedValue({ ...order });
  db.paymentAttempt.findUnique.mockReset().mockResolvedValue(null);
  (getOrCreatePaymentAttempt as jest.Mock).mockResolvedValue({ ...attempt });
  (ensureCrmReservation as jest.Mock).mockImplementation(async (_order, value) => value);
});

it.each(['preparing', 'issued', 'expired', 'void'])('blocks provider start for an existing %s invoice even if method is stale', async documentStatus => {
  db.order.findUnique.mockResolvedValue({ ...order, invoice: { ...issued, documentStatus } });
  await expect(createPayment(order.id, 'https://example.test/return')).rejects.toMatchObject({ code: 'BANK_INVOICE_PAYMENT_LOCKED' });
  expect(getOrCreatePaymentAttempt).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(db.paymentAttempt.update).not.toHaveBeenCalled();
});

it('checks the locked state again after an initially eligible read', async () => {
  db.order.findUnique.mockResolvedValueOnce({ ...order }).mockResolvedValue({ ...order, invoice: issued });
  await expect(createPayment(order.id, 'https://example.test/return')).rejects.toMatchObject({ code: 'BANK_INVOICE_PAYMENT_LOCKED' });
  expect(db.$queryRaw).toHaveBeenCalled();
  expect(getOrCreatePaymentAttempt).not.toHaveBeenCalled();
  expect(ensureCrmReservation).not.toHaveBeenCalled();
});

it('rechecks the shared lock immediately before the durable provider-start marker', async () => {
  db.order.findUnique.mockResolvedValueOnce({ ...order }).mockResolvedValueOnce({ ...order })
    .mockResolvedValue({ ...order, paymentMethod: 'bank_invoice', invoice: issued });
  await expect(createPayment(order.id, 'https://example.test/return')).rejects.toMatchObject({ code: 'BANK_INVOICE_PAYMENT_LOCKED' });
  expect(ensureCrmReservation).toHaveBeenCalledTimes(1);
  expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  expect(db.paymentAttempt.update).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

it('still processes a late canceled webhook and schedules release of the OLD reservation', async () => {
  db.order.findUnique.mockResolvedValue({ ...order, paymentMethod: 'bank_invoice', invoice: issued });
  db.paymentAttempt.findUnique.mockResolvedValue({ ...attempt, status: 'canceled', providerPaymentId: 'old-payment' });
  db.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
  db.outboxEvent.upsert.mockResolvedValue({ id: 'release' });
  await expect(handlePaymentWebhook({ object: { id: 'old-payment', status: 'canceled', metadata: { orderId: order.id } } }))
    .resolves.toMatchObject({ success: true, status: 'canceled' });
  expect(db.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { deduplicationKey: 'crm-reservation-release:invoice-reserve' },
  }));
});

it('uses integer kopecks and accepts only binary floating-point noise', () => {
  expect(invoiceAmountMinor(123.45)).toBe(12345n);
  expect(invoiceAmountMinor(0.1 + 0.2)).toBe(30n);
  for (const value of [1.005, -1, NaN, Infinity, '12.34', Number.MAX_SAFE_INTEGER]) {
    expect(() => invoiceAmountMinor(value)).toThrow();
  }
});

it('takes prices only from Order snapshot, requires matching totals and detaches positions', () => {
  const items = [{ productId: '1', name: 'Part', price: 0.1, quantity: 3 }];
  const result = buildInvoiceItemsSnapshot(items, 0.3);
  expect(result.amountMinor).toBe(30n);
  expect(result.itemsSnapshot[0]).toMatchObject({ unitPriceMinor: '10', totalMinor: '30', quantity: 3 });
  items[0].name = 'Changed';
  expect(result.itemsSnapshot[0].name).toBe('Part');
  expect(() => buildInvoiceItemsSnapshot(items, 0.4)).toThrow();
  expect(() => buildInvoiceItemsSnapshot([], 0)).toThrow();
  expect(() => buildInvoiceItemsSnapshot([{ ...items[0], quantity: 1.5 }], 0.15)).toThrow();
});
