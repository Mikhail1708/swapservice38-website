import { createBankInvoiceDeliveryService, BANK_INVOICE_INTAKE_TYPE } from '../../../src/services/bankInvoiceDelivery.service';

describe('bank invoice durable delivery', () => {
  const previousKey = process.env.INTERNAL_API_KEY;
  const previousPublicUrl = process.env.PUBLIC_APP_URL;
  beforeAll(() => { process.env.INTERNAL_API_KEY = 'test-internal-key'; process.env.PUBLIC_APP_URL = 'https://example.test'; });
  afterAll(() => {
    if (previousKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = previousKey;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousPublicUrl;
  });

  function fixture() {
    const invoice = { id: 'invoice-1', paymentStatus: 'unpaid', documentStatus: 'preparing',
      amountMinor: 10000n, currency: 'RUB', invoiceNumber: 'BI-2026-invoice-1', orderNumberSnapshot: 'SO-1',
      issuedAt: null, dueAt: new Date('2026-10-01T02:00:00.000Z'),
      sellerSnapshot: { vatLabel: 'Без НДС' }, buyerSnapshot: { legalName: 'Buyer', email: 'buyer@example.test' },
      itemsSnapshot: [{ productId: '1', quantity: 1 }] };
    const order = { id: 'order-1', paymentMethod: 'bank_invoice', invoice, paymentAttempts: [],
      status: 'pending', cancellationState: 'none', crmOrderId: null };
    const request = { contractVersion: 1, externalOrderId: order.id, invoiceId: invoice.id,
      requestId: 'bank-invoice-intake:invoice-1', invoiceNumber: 'BI-2026-invoice-1',
      issuedAt: '2026-09-28T02:00:00.000Z', dueAt: '2026-10-01T02:00:00.000Z',
      amountMinor: '10000', currency: 'RUB', buyerSnapshot: invoice.buyerSnapshot,
      itemsSnapshot: invoice.itemsSnapshot };
    const event = { id: 'event-1', aggregateId: order.id, type: BANK_INVOICE_INTAKE_TYPE,
      status: 'pending', attempts: 0, processedAt: null, lockedAt: null,
      nextAttemptAt: new Date(0), payload: { request, sellerSnapshot: { vatLabel: 'Без НДС' } } };
    const db: any = { $queryRaw: jest.fn().mockResolvedValue([]),
      outboxEvent: { findUnique: jest.fn().mockResolvedValue(event),
        findFirst: jest.fn().mockResolvedValue(event), update: jest.fn().mockResolvedValue(event),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), upsert: jest.fn().mockResolvedValue({}) },
      order: { findUnique: jest.fn().mockResolvedValue(order), update: jest.fn().mockResolvedValue(order) },
      invoice: { update: jest.fn().mockImplementation(({ data }: any) => ({ ...invoice, ...data })) } };
    db.emailOutboxEvent = { upsert: jest.fn().mockResolvedValue({}) };
    db.$transaction = jest.fn(async (fn: any) => fn(db));
    const result = { contractVersion: 1, externalOrderId: order.id, invoiceId: invoice.id,
      paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', allocationStatus: 'held',
      invoiceNumber: request.invoiceNumber, amountMinor: request.amountMinor, currency: 'RUB',
      dueAt: request.dueAt, crmOrderId: 42, documentNumber: 'SO-42' };
    const post = jest.fn().mockResolvedValue({ data: result });
    return { invoice, order, request, event, db, result, post,
      service: createBankInvoiceDeliveryService(db, post) };
  }

  it('sends the durable snapshot and issues with the planned dates after CRM confirmation', async () => {
    const f = fixture();
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(true);
    expect(f.post).toHaveBeenCalledWith(expect.stringContaining('/internal/v1/invoice-orders'), f.request,
      expect.objectContaining({ timeout: 15000, headers: expect.objectContaining({ 'X-API-Key': 'test-internal-key' }) }));
    expect(f.db.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      documentStatus: 'issued', invoiceNumber: f.request.invoiceNumber,
      issuedAt: new Date(f.request.issuedAt), dueAt: new Date(f.request.dueAt), orderNumberSnapshot: 'SO-42',
    }) }));
  });

  it('never finalizes a stale HTTP response after another worker owns the event', async () => {
    const f = fixture();
    f.db.outboxEvent.findFirst.mockResolvedValue(null);
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.db.invoice.update).not.toHaveBeenCalled();
    expect(f.db.order.update).not.toHaveBeenCalled();
  });

  it('fails the transaction if recovery revokes ownership during finalization', async () => {
    const f = fixture();
    f.db.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.db.outboxEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: f.event.id, status: 'processing', attempts: 1, lockedAt: expect.any(Date) }),
      data: expect.objectContaining({ status: 'pending' }),
    }));
  });

  it('does not issue on a mismatched CRM amount', async () => {
    const f = fixture();
    f.result.amountMinor = '9999';
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.db.invoice.update).not.toHaveBeenCalled();
  });

  it('does not send an intake with modified immutable items', async () => {
    const f = fixture();
    f.request.itemsSnapshot = [{ productId: '2', quantity: 1 }];
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.post).not.toHaveBeenCalled();
    expect(f.db.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }));
  });

  it('keeps exhausted events failed without another HTTP call', async () => {
    const f = fixture();
    f.event.attempts = 8;
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.post).not.toHaveBeenCalled();
  });

  it('does not store transport secrets or response bodies in failure diagnostics', async () => {
    const f = fixture();
    f.post.mockRejectedValue({ message: 'credential-and-personal-data', response: { status: 503, data: { secret: 'secret-value' } } });
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(false);
    expect(f.db.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'pending', lastError: 'CRM HTTP 503',
    }) }));
  });

  it('queues release instead of issuing if cancellation arrives during HTTP', async () => {
    const f = fixture();
    f.post.mockImplementation(async () => {
      f.order.cancellationState = 'requested';
      return { data: f.result };
    });
    await expect(f.service.dispatch(f.event.id)).resolves.toBe(true);
    expect(f.db.invoice.update).not.toHaveBeenCalled();
    expect(f.db.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deduplicationKey: 'bank-invoice-release:invoice-1' },
    }));
  });
});
