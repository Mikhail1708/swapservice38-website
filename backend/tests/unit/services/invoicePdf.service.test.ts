import { invoiceDocumentData, renderInvoicePdf } from '../../../src/services/invoicePdf.service';

const invoice = () => ({
  id: 'invoice-1', documentStatus: 'issued', invoiceNumber: 'BI-2026-1', orderNumberSnapshot: 'WEB-1',
  amountMinor: 12500n, currency: 'RUB', issuedAt: new Date('2026-09-29T00:00:00.000Z'), dueAt: new Date('2026-10-02T00:00:00.000Z'),
  paymentPurpose: 'Оплата по счёту №BI-2026-1 за товары по заказу №WEB-1. Без НДС.',
  sellerSnapshot: { legalName: 'ИП БАТВЕНКО НИКОЛАЙ СЕРГЕЕВИЧ', inn: '381011379046', ogrnip: '315385000059546', legalAddress: 'Иркутск', settlementAccount: '40802810900000298096', bankName: 'АО «ТБанк»', bankBik: '044525974', bankInn: '7710140679', bankCorrespondentAccount: '30101810145250000974', bankAddress: 'Москва', vatLabel: 'Без НДС' },
  buyerSnapshot: { legalName: 'ООО Тест', inn: '1234567890', kpp: '123456789', legalAddress: 'Иркутск', contactName: 'Иван', phone: '+79990000000', email: 'buyer@example.test' },
  itemsSnapshot: [{ name: 'Старое название товара', quantity: 1, unitPriceMinor: '12500', totalMinor: '12500' }],
});

describe('immutable invoice PDF', () => {
  it('renders Russian PDF from Invoice snapshots and exact amount', async () => {
    const data = invoice();
    const pdf = await renderInvoicePdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(invoiceDocumentData(data).amountMinor).toBe(12500n);
    expect(pdf.includes(Buffer.from('12500'))).toBe(false); // text is encoded by the embedded font
  });

  it('refuses preparing, empty, or financially inconsistent snapshots', () => {
    expect(() => invoiceDocumentData({ ...invoice(), documentStatus: 'preparing' })).toThrow('INVOICE_NOT_ISSUED');
    expect(() => invoiceDocumentData({ ...invoice(), itemsSnapshot: [] })).toThrow('INVOICE_AMOUNT_MISMATCH');
    expect(() => invoiceDocumentData({ ...invoice(), amountMinor: 12501n })).toThrow('INVOICE_AMOUNT_MISMATCH');
  });
});
