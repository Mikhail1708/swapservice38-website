import axios from 'axios';
import {
  assertCheckoutSnapshotStillCurrent,
  validateCheckoutItems,
} from '../../../src/services/checkoutInventory.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const crmProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 1, name: 'Актуальный товар', price: 125.5, stock: 10,
  sku: 'SKU-1', images: ['/product.webp'], ...overrides,
});
const axiosError = (status?: number) => ({
  isAxiosError: true,
  response: status ? { status } : undefined,
});

describe('checkout inventory validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.isAxiosError.mockImplementation((error: any) => error?.isAxiosError === true);
  });

  it('rebuilds the order snapshot and total from fresh CRM data', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct() });
    const result = await validateCheckoutItems([{
      productId: '1', name: 'Старое название', price: 99, quantity: 2, image: '/old.webp',
    }]);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/public/products/1',
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(result).toEqual({
      items: [{
        productId: '1', name: 'Актуальный товар', price: 125.5, quantity: 2,
        image: '/product.webp', sku: 'SKU-1', maxStock: 10,
      }],
      total: 251,
    });
  });

  it('aggregates duplicate product ids before checking stock', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ stock: 3 }) });
    const result = await validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 1 },
      { productId: '1', name: 'A', price: 1, quantity: 2 },
    ]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(result.items[0].quantity).toBe(3);
  });

  it('rejects insufficient aggregate stock', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ stock: 2 }) });
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 3 },
    ])).rejects.toMatchObject({
      status: 409, code: 'INSUFFICIENT_STOCK',
      details: { requestedQuantity: 3, availableStock: 2 },
    });
  });

  it('accepts quantity exactly equal to stock', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ stock: 3 }) });
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 3 },
    ])).resolves.toMatchObject({ items: [{ quantity: 3, maxStock: 3 }] });
  });

  it('accepts a zero CRM price', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ price: 0, stock: 1 }) });
    const result = await validateCheckoutItems([
      { productId: '1', name: 'A', price: 999, quantity: 1 },
    ]);
    expect(result.total).toBe(0);
    expect(result.items[0].price).toBe(0);
  });

  it('returns a product conflict for CRM 404', async () => {
    mockedAxios.get.mockRejectedValue(axiosError(404));
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 1 },
    ])).rejects.toMatchObject({ status: 409, code: 'PRODUCT_UNAVAILABLE' });
  });

  it('retries transient CRM errors and fails closed', async () => {
    mockedAxios.get.mockRejectedValue(axiosError(500));
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 1 },
    ])).rejects.toMatchObject({ status: 503, code: 'CRM_UNAVAILABLE' });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed CRM data', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ stock: -1 }) });
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 1 },
    ])).rejects.toMatchObject({ status: 502, code: 'INVALID_CRM_PRODUCT' });
  });

  it.each([
    { price: null },
    { price: ' ' },
    { stock: null },
    { stock: '' },
  ])('rejects null or blank CRM numeric fields: %j', async (overrides) => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct(overrides) });
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 1 },
    ])).rejects.toMatchObject({ status: 502, code: 'INVALID_CRM_PRODUCT' });
  });

  it('rejects invalid quantities before calling CRM', async () => {
    await expect(validateCheckoutItems([
      { productId: '1', name: 'A', price: 1, quantity: 0 },
    ])).rejects.toMatchObject({ status: 400, code: 'INVALID_CART_ITEM' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('blocks payment when the order price no longer matches CRM', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ price: 200 }) });
    await expect(assertCheckoutSnapshotStillCurrent([
      { productId: '1', name: 'A', price: 100, quantity: 1 },
    ], 100)).rejects.toMatchObject({
      status: 409, code: 'ORDER_PRICE_CHANGED', details: { currentTotal: 200 },
    });
  });

  it('allows payment when the snapshot is still current', async () => {
    mockedAxios.get.mockResolvedValue({ data: crmProduct({ price: 100 }) });
    await expect(assertCheckoutSnapshotStillCurrent([
      { productId: '1', name: 'A', price: 100, quantity: 2 },
    ], 200)).resolves.toBeUndefined();
  });
});
