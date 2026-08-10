"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crm_service_1 = require("../../../src/services/crm.service");
const axios_1 = __importDefault(require("axios"));
const redis_1 = __importDefault(require("../../../src/config/redis"));
jest.mock('axios');
jest.mock('../../../src/config/redis');
const mockAxios = axios_1.default;
const mockRedis = redis_1.default;
describe('CRM Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRM_API_URL = 'http://localhost:5000';
    });
    describe('getProductsFromCRM', () => {
        it('should return products from cache if available', async () => {
            const mockProducts = { items: [{ id: 1, name: 'Product 1' }] };
            mockRedis.get.mockResolvedValue(JSON.stringify(mockProducts));
            const result = await (0, crm_service_1.getProductsFromCRM)({ category: 'test' });
            expect(result).toEqual(mockProducts);
        });
        it('should fetch products from CRM and cache them', async () => {
            mockRedis.get.mockResolvedValue(null);
            const mockProducts = { items: [{ id: 1, name: 'Product 1' }] };
            mockAxios.get.mockResolvedValue({ data: mockProducts });
            mockRedis.setex.mockResolvedValue('OK');
            const result = await (0, crm_service_1.getProductsFromCRM)({ category: 'test' });
            expect(result).toEqual(mockProducts);
            expect(mockAxios.get).toHaveBeenCalled();
            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });
    describe('getProductFromCRM', () => {
        it('should return product from cache if available', async () => {
            const mockProduct = { id: 1, name: 'Product 1' };
            mockRedis.get.mockResolvedValue(JSON.stringify(mockProduct));
            const result = await (0, crm_service_1.getProductFromCRM)(1);
            expect(result).toEqual(mockProduct);
        });
        it('should fetch product from CRM and cache it', async () => {
            mockRedis.get.mockResolvedValue(null);
            const mockProduct = { id: 1, name: 'Product 1' };
            mockAxios.get.mockResolvedValue({ data: mockProduct });
            mockRedis.setex.mockResolvedValue('OK');
            const result = await (0, crm_service_1.getProductFromCRM)(1);
            expect(result).toEqual(mockProduct);
            expect(mockAxios.get).toHaveBeenCalled();
            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });
    describe('createOrderInCRM', () => {
        it('should create order in CRM', async () => {
            const orderData = {
                items: [{ productId: 1, quantity: 1 }],
                client: { firstName: 'Test', phone: '+79999999999' },
                deliveryMethod: 'courier',
                source: 'website',
            };
            const mockResponse = { data: { success: true, orderId: 123 } };
            mockAxios.post.mockResolvedValue(mockResponse);
            const result = await (0, crm_service_1.createOrderInCRM)(orderData);
            expect(result).toEqual(mockResponse.data);
            expect(mockAxios.post).toHaveBeenCalled();
        });
    });
    describe('checkCRMHealth', () => {
        it('should return true if CRM is healthy', async () => {
            mockAxios.get.mockResolvedValue({ status: 200 });
            const result = await (0, crm_service_1.checkCRMHealth)();
            expect(result).toBe(true);
        });
        it('should return false if CRM is unavailable', async () => {
            mockAxios.get.mockRejectedValue(new Error('Connection refused'));
            const result = await (0, crm_service_1.checkCRMHealth)();
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=crm.service.test.js.map