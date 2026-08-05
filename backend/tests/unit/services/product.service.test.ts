import { getProducts, getProductById } from '../../../src/services/product.service';
import redis from '../../../src/config/redis';

jest.mock('../../../src/config/redis');

const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Product Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should return products from cache if available', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(mockProducts));

      const result = await getProducts({ category: 'test' });

      expect(result).toEqual(mockProducts);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should fetch products from CRM and cache them', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      // Мок для axios будет в integration тестах
      // В unit тестах проверяем только логику кэша
      const result = await getProducts({ category: 'test' });

      expect(result).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('getProductById', () => {
    it('should return product from cache if available', async () => {
      const mockProduct = { id: '1', name: 'Product 1', price: 100 };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await getProductById('1');

      expect(result).toEqual(mockProduct);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should return null if product not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getProductById('999');

      expect(result).toBeNull();
    });
  });
});