"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCartWithTotal = exports.clearCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
// backend/src/services/cart.service.ts
const uuid_1 = require("uuid");
const prisma_1 = require("../config/prisma");
// ✅ БЕЗОПАСНОЕ ПРИВЕДЕНИЕ С ОБРАБОТКОЙ ОШИБОК
const safeItems = (items) => {
    if (!items)
        return [];
    if (Array.isArray(items)) {
        return items.filter((item) => item && typeof item === 'object' &&
            'productId' in item &&
            'quantity' in item &&
            'name' in item &&
            'price' in item);
    }
    return [];
};
// Получение корзины по userId или guestId
const getCart = async (userId, guestId) => {
    if (!userId && !guestId) {
        throw new Error('Необходим userId или guestId');
    }
    let cart = await prisma_1.prisma.cart.findFirst({
        where: userId ? { userId } : { guestId },
    });
    if (!cart) {
        const newGuestId = guestId || (0, uuid_1.v4)();
        cart = await prisma_1.prisma.cart.create({
            data: {
                userId: userId || null,
                guestId: newGuestId,
                items: [],
            },
        });
    }
    return cart;
};
exports.getCart = getCart;
// Добавление товара в корзину
const addToCart = async (productId, productName, price, quantity = 1, image, userId, guestId) => {
    if (!userId && !guestId) {
        guestId = (0, uuid_1.v4)();
    }
    const cart = await (0, exports.getCart)(userId, guestId);
    // ✅ БЕЗОПАСНОЕ ПРИВЕДЕНИЕ
    let items = safeItems(cart.items);
    const existingIndex = items.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
        // ✅ УВЕРЕНЫ, ЧТО ЭТО CartItem
        items[existingIndex].quantity += quantity;
    }
    else {
        items.push({
            productId,
            name: productName,
            price,
            quantity,
            image,
        });
    }
    const updatedCart = await prisma_1.prisma.cart.update({
        where: { id: cart.id },
        data: { items: items },
    });
    return updatedCart;
};
exports.addToCart = addToCart;
// Обновление количества товара в корзине
const updateCartItem = async (cartId, productId, quantity) => {
    const cart = await prisma_1.prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart)
        throw new Error('Корзина не найдена');
    let items = safeItems(cart.items);
    const itemIndex = items.findIndex((item) => item.productId === productId);
    if (itemIndex < 0)
        throw new Error('Товар не найден в корзине');
    if (quantity <= 0) {
        items.splice(itemIndex, 1);
    }
    else {
        // ✅ УВЕРЕНЫ, ЧТО ЭТО CartItem
        items[itemIndex].quantity = quantity;
    }
    return await prisma_1.prisma.cart.update({
        where: { id: cartId },
        data: { items: items },
    });
};
exports.updateCartItem = updateCartItem;
// Очистка корзины
const clearCart = async (cartId) => {
    return await prisma_1.prisma.cart.update({
        where: { id: cartId },
        data: { items: [] },
    });
};
exports.clearCart = clearCart;
// Получение корзины с подсчётом суммы
const getCartWithTotal = async (userId, guestId) => {
    const cart = await (0, exports.getCart)(userId, guestId);
    const items = safeItems(cart.items);
    const total = items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
    return {
        ...cart,
        total,
        itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
};
exports.getCartWithTotal = getCartWithTotal;
//# sourceMappingURL=cart.service.js.map