"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStatusFromCRM = exports.createOrderInCRM = exports.clearCart = exports.getCartWithTotal = void 0;
// backend/src/services/order.service.ts (САЙТ)
const axios_1 = __importDefault(require("axios"));
const internalApiKey_1 = require("../utils/internalApiKey");
const prisma_1 = require("../config/prisma");
// ============================================================
// ПОЛУЧЕНИЕ КОРЗИНЫ
// ============================================================
const getCartWithTotal = async (userId, guestId) => {
    let cart = null;
    if (userId) {
        cart = await prisma_1.prisma.cart.findUnique({
            where: { userId: String(userId) },
        });
    }
    else if (guestId) {
        cart = await prisma_1.prisma.cart.findUnique({
            where: { guestId: guestId },
        });
    }
    if (!cart) {
        return { id: null, items: [], total: 0, itemsCount: 0 };
    }
    const items = cart.items || [];
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return {
        id: cart.id,
        items: items,
        total: total,
        itemsCount: itemsCount,
    };
};
exports.getCartWithTotal = getCartWithTotal;
// ============================================================
// ОЧИСТКА КОРЗИНЫ
// ============================================================
const clearCart = async (cartId) => {
    return prisma_1.prisma.cart.update({
        where: { id: cartId },
        data: { items: [] },
    });
};
exports.clearCart = clearCart;
// ============================================================
// СОЗДАНИЕ ЗАКАЗА В CRM
// ============================================================
const createOrderInCRM = async (orderData) => {
    const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
    const url = `${CRM_API_URL}/api/sale-documents/public`;
    try {
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
// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА ЗАКАЗА ИЗ CRM
// ============================================================
const getOrderStatusFromCRM = async (crmOrderId) => {
    const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
    try {
        const response = await axios_1.default.get(`${CRM_API_URL}/api/sale-documents/${crmOrderId}/status`, { timeout: 5000 });
        return response.data;
    }
    catch (error) {
        return { orderStatus: 'unknown' };
    }
};
exports.getOrderStatusFromCRM = getOrderStatusFromCRM;
//# sourceMappingURL=order.service.js.map