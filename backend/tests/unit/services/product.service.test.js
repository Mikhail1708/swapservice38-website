"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const product_service_1 = require("../../../src/services/product.service");
const redis_1 = __importDefault(require("../../../src/config/redis"));
jest.mock('../../../src/config/redis');
const mockRedis = redis_1.default;
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
            const result = await (0, product_service_1.getProducts)({ category: 'test' });
            expect(result).toEqual(mockProducts);
            expect(mockRedis.get).toHaveBeenCalled();
        });
        it('should fetch products from CRM and cache them', async () => {
            mockRedis.get.mockResolvedValue(null);
            mockRedis.setex.mockResolvedValue('OK');
            // Мок для axios будет в integration тестах
            // В unit тестах проверяем только логику кэша
            const result = await (0, product_service_1.getProducts)({ category: 'test' });
            expect(result).toBeDefined();
            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });
    describe('getProductById', () => {
        it('should return product from cache if available', async () => {
            const mockProduct = { id: '1', name: 'Product 1', price: 100 };
            mockRedis.get.mockResolvedValue(JSON.stringify(mockProduct));
            const result = await (0, product_service_1.getProductById)('1');
            expect(result).toEqual(mockProduct);
            expect(mockRedis.get).toHaveBeenCalled();
        });
        it('should return null if product not found', async () => {
            mockRedis.get.mockResolvedValue(null);
            const result = await (0, product_service_1.getProductById)('999');
            expect(result).toBeNull();
        });
    });
});
//# sourceMappingURL=product.service.test.js.map