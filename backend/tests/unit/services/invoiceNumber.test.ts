import { ensureBankInvoiceIntake } from '../../../src/services/bankInvoiceDelivery.service';

describe('immutable invoice number allocation', () => {
  const invoice = { id: 'invoice-1', documentStatus: 'preparing', paymentStatus: 'unpaid',
    amountMinor: 10000n, currency: 'RUB', buyerSnapshot: {}, itemsSnapshot: [] };
  const order = { id: 'order-1', paymentMethod: 'bank_invoice' };
  function fixture() {
    return { $queryRaw: jest.fn().mockResolvedValue([{ value: 10001n }]), outboxEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(async ({ create }) => create),
    } };
  }

  it('allocates a five-digit number only when creating the first durable request', async () => {
    const tx = fixture();
    const event = await ensureBankInvoiceIntake(tx as any, order, invoice);
    expect((event.payload as any).request.invoiceNumber).toBe('10001');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    tx.outboxEvent.findUnique.mockResolvedValue(event as never);
    expect(await ensureBankInvoiceIntake(tx as any, order, invoice)).toBe(event);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('preserves an already persisted legacy BI number and snapshot on retry', async () => {
    const tx = fixture();
    const old = { payload: { request: { invoiceNumber: 'BI-2026-legacy', issuedAt: 'old' } } };
    tx.outboxEvent.findUnique.mockResolvedValue(old as never);
    expect(await ensureBankInvoiceIntake(tx as any, order, invoice)).toBe(old);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.outboxEvent.upsert).not.toHaveBeenCalled();
  });

  it('fails without creating an event if the database sequence is exhausted', async () => {
    const tx = fixture();
    tx.$queryRaw.mockRejectedValue(new Error('reached maximum value of sequence'));
    await expect(ensureBankInvoiceIntake(tx as any, order, invoice)).rejects.toThrow('maximum value');
    expect(tx.outboxEvent.upsert).not.toHaveBeenCalled();
  });
});
