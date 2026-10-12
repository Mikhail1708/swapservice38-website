"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.updateCart = exports.addToCart = exports.getCart = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../config/logger");
const productAvailability_1 = require("../utils/productAvailability");
const prisma_1 = require("../config/prisma");
// ============================================================
// ПОЛУЧЕНИЕ ТОВАРА ИЗ CRM С ОСТАТКОМ
// ============================================================
const getProductFromCRM = async (productId) => {
    try {
        const crmApiUrl = process.env.CRM_API_URL || 'http://localhost:5000';
        // Используем AbortController для таймаута
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${crmApiUrl}/api/public/products/${productId}`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return {
            id: data.id || data.productId || 0,
            name: data.name || 'Товар',
            price: data.price || data.retail_price || 0,
            retail_price: data.retail_price || data.price || 0,
            sku: data.sku || data.article || null,
            ...(0, productAvailability_1.productAvailability)(data),
            images: data.images || [],
        };
    }
    catch (error) {
        return null;
    }
};
// ============================================================
// ФОРМАТИРОВАНИЕ ОТВЕТА КОРЗИНЫ
// ============================================================
const formatCartResponse = (cart) => {
    const items = Array.isArray(cart.items) ? cart.items : [];
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return {
        cart: {
            id: cart.id,
            items: items,
            total: total,
            itemsCount: itemsCount,
        },
    };
};
// ============================================================
// ПОЛУЧЕНИЕ КОРЗИНЫ
// ============================================================
const getCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        let guestId = req.cookies?.guestId;
        let cart = null;
        if (userId) {
            cart = await prisma_1.prisma.cart.findUnique({
                where: { userId: String(userId) },
            });
            if (!cart && guestId) {
                const guestCart = await prisma_1.prisma.cart.findUnique({
                    where: { guestId: guestId },
                });
                if (guestCart && guestCart.items && guestCart.items.length > 0) {
                    cart = await prisma_1.prisma.cart.create({
                        data: {
                            userId: String(userId),
                            items: guestCart.items,
                        },
                    });
                    await prisma_1.prisma.cart.delete({
                        where: { guestId: guestId },
                    });
                    res.clearCookie('guestId', {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        path: '/',
                    });
                }
                else {
                    cart = await prisma_1.prisma.cart.create({
                        data: {
                            userId: String(userId),
                            items: [],
                        },
                    });
                }
            }
            if (!cart) {
                cart = await prisma_1.prisma.cart.create({
                    data: {
                        userId: String(userId),
                        items: [],
                    },
                });
            }
        }
        else if (guestId) {
            cart = await prisma_1.prisma.cart.findUnique({
                where: { guestId: guestId },
            });
            if (!cart) {
                cart = await prisma_1.prisma.cart.create({
                    data: {
                        guestId: guestId,
                        items: [],
                    },
                });
            }
        }
        else {
            guestId = (0, uuid_1.v4)();
            cart = await prisma_1.prisma.cart.create({
                data: {
                    guestId: guestId,
                    items: [],
                },
            });
            res.cookie('guestId', guestId, {
                httpOnly: true,
                maxAge: 30 * 24 * 60 * 60 * 1000,
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });
        }
        res.json(formatCartResponse(cart));
    }
    catch (error) {
        logger_1.log.error('Cart load failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Ошибка получения корзины' });
    }
};
exports.getCart = getCart;
// ============================================================
// ДОБАВЛЕНИЕ В КОРЗИНУ — С ПРОВЕРКОЙ ОСТАТКА
// ============================================================
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.user?.id;
        let guestId = req.cookies?.guestId;
        // ✅ 1. ПОЛУЧАЕМ ТОВАР ИЗ CRM С ОСТАТКОМ
        const product = await getProductFromCRM(productId);
        if (!product) {
            res.status(404).json({ error: 'Товар не найден' });
            return;
        }
        const availableStock = product.stock || 0;
        if (availableStock <= 0) {
            res.status(400).json({
                error: 'Товар отсутствует на складе',
                code: 'OUT_OF_STOCK',
                availableStock: 0,
            });
            return;
        }
        // ✅ 2. НАХОДИМ ИЛИ СОЗДАЁМ КОРЗИНУ
        let cart = null;
        let currentItems = [];
        if (userId) {
            cart = await prisma_1.prisma.cart.findUnique({
                where: { userId: String(userId) },
            });
        }
        else {
            if (!guestId) {
                guestId = (0, uuid_1.v4)();
                res.cookie('guestId', guestId, {
                    httpOnly: true,
                    maxAge: 30 * 24 * 60 * 60 * 1000,
                    path: '/',
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                });
            }
            cart = await prisma_1.prisma.cart.findUnique({
                where: { guestId: guestId },
            });
        }
        if (!cart) {
            if (userId) {
                cart = await prisma_1.prisma.cart.create({
                    data: {
                        userId: String(userId),
                        items: [],
                    },
                });
            }
            else {
                cart = await prisma_1.prisma.cart.create({
                    data: {
                        guestId: guestId,
                        items: [],
                    },
                });
            }
        }
        currentItems = Array.isArray(cart.items) ? cart.items : [];
        // ✅ 3. СЧИТАЕМ СКОЛЬКО УЖЕ В КОРЗИНЕ ЭТОГО ТОВАРА
        const existingItemIndex = currentItems.findIndex((item) => String(item.productId) === String(productId));
        const currentQuantity = existingItemIndex !== -1 ? currentItems[existingItemIndex].quantity : 0;
        const newQuantity = currentQuantity + quantity;
        // ✅ 4. ПРОВЕРЯЕМ ЧТО НЕ ПРЕВЫШАЕМ ОСТАТОК
        if (newQuantity > availableStock) {
            const maxAvailable = availableStock - currentQuantity;
            res.status(400).json({
                error: `Недостаточно товара на складе. Доступно: ${availableStock} шт., в корзине: ${currentQuantity} шт.`,
                code: 'STOCK_LIMIT_EXCEEDED',
                availableStock,
                currentQuantity,
                maxAvailable: Math.max(0, maxAvailable),
                productId,
            });
            return;
        }
        // ✅ 5. ОБНОВЛЯЕМ КОРЗИНУ
        if (existingItemIndex !== -1) {
            currentItems[existingItemIndex].quantity = newQuantity;
        }
        else {
            const newItem = {
                productId: String(productId),
                name: product.name || 'Товар',
                price: product.price || 0,
                quantity: quantity,
                image: product.images?.[0] || '/images/logo/logo.png',
                sku: product.sku || null,
                maxStock: availableStock,
            };
            currentItems.push(newItem);
        }
        let updatedCart;
        if (userId) {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { userId: String(userId) },
                data: { items: currentItems }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
            });
        }
        else {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { guestId: guestId },
                data: { items: currentItems }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
            });
        }
        res.json(formatCartResponse(updatedCart));
    }
    catch (error) {
        logger_1.log.error('Cart add failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Ошибка добавления в корзину' });
    }
};
exports.addToCart = addToCart;
// ============================================================
// ОБНОВЛЕНИЕ КОЛИЧЕСТВА — С ПРОВЕРКОЙ ОСТАТКА
// ============================================================
const updateCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user?.id;
        const guestId = req.cookies?.guestId;
        if (!userId && !guestId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        // ✅ 1. ПОЛУЧАЕМ ТОВАР ИЗ CRM С ОСТАТКОМ
        const product = await getProductFromCRM(productId);
        if (!product) {
            res.status(404).json({ error: 'Товар не найден' });
            return;
        }
        const availableStock = product.stock || 0;
        // ✅ 2. НАХОДИМ КОРЗИНУ
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
            res.status(404).json({ error: 'Корзина не найдена' });
            return;
        }
        let items = Array.isArray(cart.items) ? cart.items : [];
        // ✅ 3. НАХОДИМ ТОВАР В КОРЗИНЕ
        const existingItemIndex = items.findIndex((item) => String(item.productId) === String(productId));
        if (existingItemIndex === -1) {
            res.status(404).json({ error: 'Товар не найден в корзине' });
            return;
        }
        // ✅ 4. ЕСЛИ quantity === 0 — УДАЛЯЕМ
        if (quantity === 0) {
            items.splice(existingItemIndex, 1);
            let updatedCart;
            if (userId) {
                updatedCart = await prisma_1.prisma.cart.update({
                    where: { userId: String(userId) },
                    data: { items: items }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
                });
            }
            else {
                updatedCart = await prisma_1.prisma.cart.update({
                    where: { guestId: guestId },
                    data: { items: items }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
                });
            }
            res.json(formatCartResponse(updatedCart));
            return;
        }
        // ✅ 5. ПРОВЕРЯЕМ ЧТО НЕ ПРЕВЫШАЕМ ОСТАТОК
        if (quantity > availableStock) {
            res.status(400).json({
                error: `Недостаточно товара на складе. Доступно: ${availableStock} шт.`,
                code: 'STOCK_LIMIT_EXCEEDED',
                availableStock,
                requestedQuantity: quantity,
                productId,
            });
            return;
        }
        // ✅ 6. ОБНОВЛЯЕМ КОЛИЧЕСТВО
        items[existingItemIndex].quantity = quantity;
        let updatedCart;
        if (userId) {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { userId: String(userId) },
                data: { items: items }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
            });
        }
        else {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { guestId: guestId },
                data: { items: items }, // ✅ ПРИВОДИМ К any ДЛЯ PRISMA
            });
        }
        res.json(formatCartResponse(updatedCart));
    }
    catch (error) {
        logger_1.log.error('Cart update failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Ошибка обновления корзины' });
    }
};
exports.updateCart = updateCart;
// ============================================================
// ОЧИСТКА КОРЗИНЫ
// ============================================================
const clearCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        const guestId = req.cookies?.guestId;
        if (!userId && !guestId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        let updatedCart;
        if (userId) {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { userId: String(userId) },
                data: { items: [] },
            });
        }
        else if (guestId) {
            updatedCart = await prisma_1.prisma.cart.update({
                where: { guestId: guestId },
                data: { items: [] },
            });
        }
        else {
            res.status(400).json({ error: 'Не удалось определить корзину' });
            return;
        }
        res.json(formatCartResponse(updatedCart));
    }
    catch (error) {
        logger_1.log.error('Cart clear failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Ошибка очистки корзины' });
    }
};
exports.clearCart = clearCart;
//# sourceMappingURL=cart.controller.js.map