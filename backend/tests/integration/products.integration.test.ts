// backend/tests/integration/products.integration.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import axios from 'axios';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Products Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRM_API_URL = 'http://localhost:5000';
  });

  // ============================================================
  // ПРОДУКТЫ
  // ============================================================
  describe('GET /api/products', () => {
    it('should return list of products', async () => {
      const mockProducts = {
        data: {
          items: [
            { id: 149, name: 'Test Product 1', retail_price: 15000 },
            { id: 115, name: 'Test Product 2', retail_price: 18000 },
          ],
        },
      };

      mockAxios.get.mockResolvedValue(mockProducts);

      const response = await request(app)
        .get('/api/products')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter products by category', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          items: [
            { id: 149, name: 'Test Product', retail_price: 15000, category: 'Test Category' },
          ],
        },
      });

      const response = await request(app)
        .get('/api/products')
        .query({ category: 'Test Category' });

      expect(response.status).toBe(200);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/products'),
        expect.objectContaining({
          params: expect.objectContaining({ category: 'Test Category' }),
        })
      );
    });

    it('should handle CRM error gracefully', async () => {
      mockAxios.get.mockRejectedValue(new Error('CRM unavailable'));

      const response = await request(app)
        .get('/api/products');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return single product', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          id: 149,
          name: 'Test Product',
          retail_price: 15000,
          stock: 10,
          images: [],
        },
      });

      const response = await request(app)
        .get('/api/products/149');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 149);
      expect(response.body).toHaveProperty('name', 'Test Product');
    });

    it('should return 404 if product not found', async () => {
      mockAxios.get.mockRejectedValue({
        response: { status: 404 },
      });

      const response = await request(app)
        .get('/api/products/999');

      expect(response.status).toBe(404);
    });
  });
});