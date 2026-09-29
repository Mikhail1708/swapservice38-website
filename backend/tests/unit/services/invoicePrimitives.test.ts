import { createInvoiceSellerSnapshot, invoiceSeller } from '../../../src/config/invoiceSeller';
import { invoiceBuyerSchema, requestInvoiceSchema } from '../../../src/schemas/invoice.schema';
import { addInvoiceBusinessDays, calculateInvoiceDueAt } from '../../../src/utils/invoiceBusinessDays';

const buyer = {
  buyerType: 'legal_entity', legalName: 'ООО Покупатель', inn: '1234567890',
  legalAddress: 'г. Иркутск, ул. Ленина, д. 1', contactName: 'Иван Иванов',
  phone: '+7 (999) 123-45-67', email: 'buyer@example.com',
};

describe('Invoice seller snapshot', () => {
  it('copies all seller details without retaining a mutable config reference', () => {
    const snapshot = createInvoiceSellerSnapshot();
    expect(snapshot).toEqual(invoiceSeller);
    expect(snapshot).not.toBe(invoiceSeller);
    expect(snapshot).not.toBe(createInvoiceSellerSnapshot());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(invoiceSeller)).toBe(true);
    expect(Reflect.set(snapshot, 'legalName', 'Changed')).toBe(false);
    expect(snapshot.vatMode).toBe('without_vat');
    expect(snapshot.vatLabel).toBe('Без НДС');
    expect(snapshot.bankBik).toBe('044525974');
    expect(typeof snapshot.inn).toBe('string');
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe('Invoice buyer validation', () => {
  it('accepts legal entity and normalizes whitespace and phone punctuation', () => {
    const result = invoiceBuyerSchema.parse({ ...buyer, legalName: ' ООО Покупатель ', kpp: '771001001' });
    expect(result.legalName).toBe('ООО Покупатель');
    expect(result.phone).toBe('+79991234567');
    expect(result.kpp).toBe('771001001');
  });

  it('accepts an entrepreneur without KPP', () => {
    expect(invoiceBuyerSchema.safeParse({ ...buyer, buyerType: 'individual_entrepreneur', inn: '123456789012' }).success).toBe(true);
  });

  it('accepts format-only test INNs for both buyer types', () => {
    expect(invoiceBuyerSchema.safeParse({ ...buyer, inn: '1234567890' }).success).toBe(true);
    expect(invoiceBuyerSchema.safeParse({ ...buyer, buyerType: 'individual_entrepreneur', inn: '123456789012' }).success).toBe(true);
  });

  it.each([
    { inn: 1234567890 }, { inn: '123456789' }, { inn: '12345678901' }, { inn: '123456789a' },
    { buyerType: 'individual_entrepreneur' }, { buyerType: 'individual_entrepreneur', inn: '1234567890' },
    { buyerType: 'individual_entrepreneur', inn: '1234567890123' }, { buyerType: 'individual_entrepreneur', inn: '123456789012', kpp: '771001001' },
    { kpp: 771001001 }, { kpp: 'bad' }, { email: 'bad' }, { phone: 'abc79991234567' },
    { legalName: ' ' }, { legalAddress: 'x' }, { contactName: 'x\u0000y' },
    { legalName: 'x'.repeat(501) }, { sellerSnapshot: {} },
  ])('rejects invalid buyer data %j', patch => {
    expect(invoiceBuyerSchema.safeParse({ ...buyer, ...patch }).success).toBe(false);
  });

  it.each(['amountMinor', 'amount', 'sellerSnapshot', 'paymentStatus', 'documentStatus', 'invoiceNumber', 'itemsSnapshot'])('rejects client field %s', key => {
    expect(requestInvoiceSchema.safeParse({ buyer, [key]: 'injected' }).success).toBe(false);
  });

  it('accepts only the buyer request and returns a detached value', () => {
    const result = requestInvoiceSchema.parse({ buyer });
    buyer.legalName = 'ООО Изменено';
    expect(result.buyer.legalName).toBe('ООО Покупатель');
    buyer.legalName = 'ООО Покупатель';
  });
});

describe('Invoice three business days in Asia/Irkutsk', () => {
  it.each([
    ['2026-09-28T10:20:30.123+08:00', '2026-10-01T10:20:30.123+08:00'],
    ['2026-09-25T10:20:30.123+08:00', '2026-09-30T10:20:30.123+08:00'],
    ['2026-09-26T10:20:30.123+08:00', '2026-09-30T10:20:30.123+08:00'],
    ['2026-09-27T10:20:30.123+08:00', '2026-09-30T10:20:30.123+08:00'],
    ['2026-12-31T10:20:30.123+08:00', '2027-01-05T10:20:30.123+08:00'],
    // Friday UTC is already Saturday in Irkutsk. Three working days end Wednesday.
    ['2026-09-25T17:20:30.123Z', '2026-09-29T17:20:30.123Z'],
    // Thursday UTC is Friday locally: skip the local weekend.
    ['2026-09-24T17:20:30.123Z', '2026-09-29T17:20:30.123Z'],
  ])('%s -> %s', (start, expected) => {
    const issuedAt = new Date(start);
    expect(calculateInvoiceDueAt(issuedAt)).toEqual(new Date(expected));
    expect(issuedAt).toEqual(new Date(start));
  });

  it('returns a detached date for zero days and rejects invalid inputs', () => {
    const start = new Date('2026-09-28T00:00:00Z');
    expect(addInvoiceBusinessDays(start, 0)).toEqual(start);
    expect(addInvoiceBusinessDays(start, 0)).not.toBe(start);
    expect(() => calculateInvoiceDueAt(new Date('invalid'))).toThrow();
    for (const days of [-1, 1.5, Infinity, 3661]) {
      expect(() => addInvoiceBusinessDays(start, days)).toThrow();
    }
  });
});
