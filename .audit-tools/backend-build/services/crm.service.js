"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCRMHealth = exports.getOrderStatusFromCRM = exports.createOrderInCRM = exports.getProductFromCRM = exports.getProductsFromCRM = void 0;
// backend/src/services/crm.service.ts
const axios_1 = __importDefault(require("axios"));
const redis_1 = __importDefault(require("../config/redis"));
const internalApiKey_1 = require("../utils/internalApiKey");
const logger_1 = require("../config/logger");
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
/**
 * Получение списка товаров из CRM
 */
const getProductsFromCRM = async (filters) => {
    const cacheKey = `crm:products:${JSON.stringify(filters || {})}`;
    const cached = await redis_1.default.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    try {
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
            params: filters,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Кэшируем на 5 минут
        await redis_1.default.setex(cacheKey, 300, JSON.stringify(response.data));
        return response.data;
    }
    catch (error) {
        logger_1.log.error('CRM product list request failed');
        throw new Error('Ошибка получения товаров из CRM');
    }
};
exports.getProductsFromCRM = getProductsFromCRM;
/**
 * Получение одного товара из CRM
 */
const getProductFromCRM = async (productId) => {
    const cacheKey = `crm:product:${productId}`;
    const cached = await redis_1.default.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    try {
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products/${productId}`, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        await redis_1.default.setex(cacheKey, 300, JSON.stringify(response.data));
        return response.data;
    }
    catch (error) {
        logger_1.log.error('CRM product request failed');
        throw new Error('Ошибка получения товара из CRM');
    }
};
exports.getProductFromCRM = getProductFromCRM;
/**
 * Создание заказа в CRM
 */
const createOrderInCRM = async (orderData) => {
    try {
        const url = `${CRM_API_URL}/api/sale-documents/public`;
        const response = await axios_1.default.post(url, orderData, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': (0, internalApiKey_1.getInternalApiKey)(),
            }
        });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && error.response) {
            throw new Error('Ошибка создания заказа в CRM');
        }
        throw new Error('Ошибка создания заказа в CRM');
    }
};
exports.createOrderInCRM = createOrderInCRM;
/**
 * Получение статуса заказа из CRM
 */
const getOrderStatusFromCRM = async (orderId) => {
    try {
        const response = await axios_1.default.get(`${CRM_API_URL}/api/sale-documents/${orderId}/status`, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        logger_1.log.error('CRM order status request failed');
        throw new Error('Ошибка получения статуса заказа');
    }
};
exports.getOrderStatusFromCRM = getOrderStatusFromCRM;
/**
 * Проверка доступности CRM
 */
const checkCRMHealth = async () => {
    try {
        const response = await axios_1.default.get(`${CRM_API_URL}/api/health`, {
            timeout: 3000
        });
        return response.status === 200;
    }
    catch (error) {
        return false;
    }
};
exports.checkCRMHealth = checkCRMHealth;
//# sourceMappingURL=crm.service.js.map