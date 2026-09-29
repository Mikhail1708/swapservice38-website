import { getOrderPaymentView, isOnlinePaymentBlocked } from '../../../src/services/orderPaymentView.service';

const pending = { status: 'pending' };
const canceled = {
  status: 'canceled', providerPaymentId: 'payment-1', reservationId: 'reservation-1', lastCheckedAt: new Date(),
};

describe('order payment projection', () => {
  it('keeps legacy orders without paymentMethod online and eligible before payment starts', () => {
    expect(getOrderPaymentView(pending)).toEqual({
      paymentMethod: 'online', paymentStatus: 'unpaid', canPayOnline: true,
      canRequestInvoice: true, canDownloadInvoice: false,
    });
  });

  it.each(['paid', 'crm_failed', 'confirmed', 'assembling', 'shipped', 'delivered'])(
    'preserves payment evidence for legacy %s orders', status => {
      expect(getOrderPaymentView({ status })).toMatchObject({ paymentStatus: 'paid', canPayOnline: false, canRequestInvoice: false });
    },
  );

  it.each(['succeeded', 'compensation_required', 'refund_required', 'refund_failed'])(
    'blocks both payment actions when attempt is %s', status => {
      expect(getOrderPaymentView(pending, { status })).toMatchObject({ paymentStatus: 'paid', canPayOnline: false, canRequestInvoice: false });
    },
  );

  it('does not hide a refund behind an old paid order status', () => {
    expect(getOrderPaymentView({ status: 'paid' }, { status: 'refunded' })).toMatchObject({
      paymentStatus: 'refunded', canPayOnline: false, canRequestInvoice: false,
    });
  });

  it.each(['pending', 'unknown', 'initiating', 'failed', 'future_status'])(
    'requires reconciliation for every existing %s attempt', status => {
      expect(getOrderPaymentView(pending, { status }, null, { reservationReleased: true })).toMatchObject({
        canRequestInvoice: false, invoiceBlockedReason: 'online_payment_unresolved',
      });
    },
  );

  it('blocks a legacy provider payment without its attempt', () => {
    expect(getOrderPaymentView({ ...pending, paymentId: 'legacy' })).toMatchObject({ paymentStatus: 'unknown', canRequestInvoice: false });
  });

  it('requires explicit reservation release evidence for a confirmed canceled payment', () => {
    expect(getOrderPaymentView(pending, canceled)).toMatchObject({ canRequestInvoice: false, invoiceBlockedReason: 'reservation_not_released' });
    expect(getOrderPaymentView({ ...pending, paymentId: 'payment-1' }, canceled, null, { reservationReleased: true }).canRequestInvoice).toBe(true);
  });

  it.each([
    { providerPaymentId: null }, { lastCheckedAt: null }, { lastCheckedAt: new Date(NaN) }, { reservationId: null },
  ])('rejects incomplete cancellation evidence %p', missing => {
    expect(getOrderPaymentView(pending, { ...canceled, ...missing }, null, { reservationReleased: true }).canRequestInvoice).toBe(false);
  });

  it('rejects a cancellation for a different provider payment', () => {
    expect(getOrderPaymentView({ ...pending, paymentId: 'different' }, canceled, null, { reservationReleased: true }).canRequestInvoice).toBe(false);
  });

  it.each(['preparing', 'issued', 'void', 'expired'])(
    'any existing %s invoice blocks online payment and a second invoice', documentStatus => {
      const invoice = { documentStatus, paymentStatus: 'unpaid' };
      expect(isOnlinePaymentBlocked(pending, invoice)).toBe(true);
      expect(getOrderPaymentView(pending, null, invoice)).toMatchObject({
        paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', canPayOnline: false,
        canRequestInvoice: false, canDownloadInvoice: false,
      });
    },
  );

  it('blocks online initiation by the bank method even before a relation is present', () => {
    const order = { ...pending, paymentMethod: 'bank_invoice' };
    expect(isOnlinePaymentBlocked(order)).toBe(true);
    expect(getOrderPaymentView(order).canPayOnline).toBe(false);
  });

  it.each(['unpaid', 'paid'])('allows an issued %s PDF, while preparing/void snapshots stay private', paymentStatus => {
    const issuedAt = new Date();
    expect(getOrderPaymentView(pending, null, { documentStatus: 'issued', paymentStatus, issuedAt }).canDownloadInvoice).toBe(true);
    for (const documentStatus of ['preparing', 'void']) {
      expect(getOrderPaymentView(pending, null, { documentStatus, paymentStatus, issuedAt }).canDownloadInvoice).toBe(false);
    }
  });

  it('does not infer invoice payment from fulfillment status', () => {
    expect(getOrderPaymentView({ status: 'confirmed', paymentMethod: 'bank_invoice' }).paymentStatus).toBe('unpaid');
  });

  it.each(['unpaid', 'paid', 'refunded'])('projects invoice %s independently of order status', paymentStatus => {
    expect(getOrderPaymentView({ status: 'confirmed' }, null, { documentStatus: 'issued', paymentStatus }).paymentStatus).toBe(paymentStatus);
  });

  it('does not hide a late successful online payment behind an unpaid invoice', () => {
    expect(getOrderPaymentView(pending, { status: 'succeeded' }, { documentStatus: 'issued', paymentStatus: 'unpaid' })).toMatchObject({
      paymentStatus: 'paid', canPayOnline: false, canRequestInvoice: false,
    });
  });

  it.each([{ cancellationState: 'requested' }, { cancellationState: 'accepted' }, { status: 'cancelled' }, { crmOrderId: 'crm-order' }])(
    'blocks new payment actions for lifecycle state %p', state => {
      expect(getOrderPaymentView({ ...pending, ...state })).toMatchObject({ canPayOnline: false, canRequestInvoice: false });
    },
  );

  it('does not claim a cancelled legacy order with no payment evidence was paid', () => {
    expect(getOrderPaymentView({ status: 'cancelled' }).paymentStatus).toBe('unpaid');
  });
});
