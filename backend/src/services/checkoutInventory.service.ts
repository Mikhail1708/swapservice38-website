import axios from 'axios';

export interface CheckoutCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string | null;
  maxStock?: number;
}

interface CRMCheckoutProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  image?: string;
}

export class CheckoutInventoryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CheckoutInventoryError';
  }
}

const crmApiUrl = () => process.env.CRM_API_URL || 'http://localhost:5000';

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    return null;
  }
  const number = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(number) ? number : null;
};

const normalizeProduct = (data: any, requestedProductId: number): CRMCheckoutProduct => {
  const id = toFiniteNumber(data?.id ?? data?.productId);
  const price = toFiniteNumber(data?.price ?? data?.retail_price);
  // CRM exposes free stock (reservations already deducted), with legacy stock fallback.
  const stock = toFiniteNumber(data?.availableStock ?? data?.stock);

  if (
    id === null || !Number.isSafeInteger(id) || id !== requestedProductId ||
    price === null || price < 0 ||
    stock === null || !Number.isSafeInteger(stock) || stock < 0
  ) {
    throw new CheckoutInventoryError(
      'CRM вернула некорректные данные товара',
      502,
      'INVALID_CRM_PRODUCT',
      { productId: String(requestedProductId) },
    );
  }

  const images = Array.isArray(data?.images)
    ? data.images.filter((image: unknown): image is string => typeof image === 'string' && image.length > 0)
    : [];

  return {
    id,
    name: typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : 'Товар',
    price: Math.round(price * 100) / 100,
    stock,
    sku: typeof data?.sku === 'string'
      ? data.sku
      : typeof data?.article === 'string'
        ? data.article
        : null,
    image: images[0],
  };
};

const isRetryableCRMError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return error.response.status === 429 || error.response.status >= 500;
};

const fetchProductForCheckout = async (productId: number): Promise<CRMCheckoutProduct> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await axios.get(`${crmApiUrl()}/api/public/products/${productId}`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
      return normalizeProduct(response.data, productId);
    } catch (error) {
      if (error instanceof CheckoutInventoryError) throw error;

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new CheckoutInventoryError(
          'Товар из корзины больше недоступен',
          409,
          'PRODUCT_UNAVAILABLE',
          { productId: String(productId) },
        );
      }

      lastError = error;
      if (attempt === 2 || !isRetryableCRMError(error)) break;
    }
  }

  // Do not serialize Axios errors: request headers may contain internal credentials.
  throw new CheckoutInventoryError(
    'Не удалось проверить цены и остатки. Повторите попытку позже',
    503,
    'CRM_UNAVAILABLE',
  );
};

export const validateCheckoutItems = async (
  cartItems: CheckoutCartItem[],
): Promise<{ items: CheckoutCartItem[]; total: number }> => {
  const quantities = new Map<number, number>();
  const originalItems = new Map<number, CheckoutCartItem>();

  for (const item of cartItems) {
    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new CheckoutInventoryError(
        'Корзина содержит некорректный товар или количество',
        400,
        'INVALID_CART_ITEM',
        { productId: String(item.productId) },
      );
    }

    quantities.set(productId, (quantities.get(productId) || 0) + item.quantity);
    if (!originalItems.has(productId)) originalItems.set(productId, item);
  }

  const products = await Promise.all(
    [...quantities.keys()].map((productId) => fetchProductForCheckout(productId)),
  );

  const items = products.map((product) => {
    const quantity = quantities.get(product.id)!;
    if (quantity > product.stock) {
      throw new CheckoutInventoryError(
        `Недостаточно товара «${product.name}» на складе`,
        409,
        'INSUFFICIENT_STOCK',
        {
          productId: String(product.id),
          requestedQuantity: quantity,
          availableStock: product.stock,
        },
      );
    }

    const original = originalItems.get(product.id)!;
    return {
      productId: String(product.id),
      name: product.name,
      price: product.price,
      quantity,
      image: product.image || original.image,
      sku: product.sku,
      maxStock: product.stock,
    };
  });

  const totalInKopecks = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );

  return { items, total: totalInKopecks / 100 };
};

export const assertCheckoutSnapshotStillCurrent = async (
  orderItems: CheckoutCartItem[],
  orderTotal: number,
): Promise<void> => {
  const validated = await validateCheckoutItems(orderItems);
  const originalByProductId = new Map(
    orderItems.map((item) => [String(item.productId), item]),
  );

  const changedItems = validated.items.flatMap((item) => {
    const original = originalByProductId.get(item.productId);
    const originalPriceInKopecks = original ? Math.round(Number(original.price) * 100) : NaN;
    const currentPriceInKopecks = Math.round(item.price * 100);

    if (
      !original ||
      original.quantity !== item.quantity ||
      originalPriceInKopecks !== currentPriceInKopecks
    ) {
      return [{
        productId: item.productId,
        oldPrice: original?.price,
        currentPrice: item.price,
        quantity: item.quantity,
      }];
    }
    return [];
  });

  if (changedItems.length > 0 || Math.round(orderTotal * 100) !== Math.round(validated.total * 100)) {
    throw new CheckoutInventoryError(
      'Цена заказа изменилась. Создайте заказ заново с актуальными ценами',
      409,
      'ORDER_PRICE_CHANGED',
      { currentTotal: validated.total, changedItems },
    );
  }
};
