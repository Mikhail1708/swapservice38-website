import { buildInvoiceItemsSnapshot } from '../../../src/services/invoice.service';

it('canonicalizes SKU in new immutable invoice items', () => {
  const item = { productId: '1', name: 'Товар', quantity: 1, price: 100 };
  expect(buildInvoiceItemsSnapshot([{ ...item, sku: ' ABC-123 ' }], 100).itemsSnapshot[0].sku).toBe('ABC-123');
  expect(buildInvoiceItemsSnapshot([{ ...item, sku: '  ' }], 100).itemsSnapshot[0].sku).toBeNull();
});
