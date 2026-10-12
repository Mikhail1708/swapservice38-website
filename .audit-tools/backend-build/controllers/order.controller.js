"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestOrderCancellationController = exports.deleteOrderController = exports.getUserOrdersController = exports.getOrderController = exports.createOrderController = void 0;
const consent_service_1 = require("../services/consent.service");
const error_middleware_1 = require("../middleware/error.middleware");
const email_service_1 = require("../services/email.service");
const checkoutInventory_service_1 = require("../services/checkoutInventory.service");
const orderCancellation_service_1 = require("../services/orderCancellation.service");
const logger_1 = require("../config/logger");
const prisma_1 = require("../config/prisma");
const invoice_service_1 = require("../services/invoice.service");
const invoice_schema_1 = require("../schemas/invoice.schema");
const isSerializableConflict = (error) => (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034');
const safeItems = (items) => {
    if (!items)
        return [];
    if (Array.isArray(items)) {
        return items.filter((item) => item && typeof item === 'object' &&
            'productId' in item &&
            'quantity' in item &&
            'price' in item);
    }
    return [];
};
const getCartWithTotal = async (userId) => {
    if (!userId) {
        console.log('ℹ️ Нет userId, возвращаем пустую корзину');
        return { id: null, items: [], total: 0, itemsCount: 0 };
    }
    const cart = await prisma_1.prisma.cart.findUnique({
        where: { userId: String(userId) },
    });
    if (!cart) {
        return { id: null, items: [], total: 0, itemsCount: 0 };
    }
    const items = safeItems(cart.items);
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return {
        id: cart.id,
        items: items,
        total: total,
        itemsCount: itemsCount,
    };
};
const mergeCart = async (userId, guestId) => {
    if (!guestId) {
        return;
    }
    try {
        const guestCart = await prisma_1.prisma.cart.findUnique({
            where: { guestId: guestId },
        });
        if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
            return;
        }
        const guestItems = safeItems(guestCart.items);
        let userCart = await prisma_1.prisma.cart.findUnique({
            where: { userId: userId },
        });
        if (userCart) {
            const userItems = safeItems(userCart.items);
            const mergedItems = [...userItems];
            for (const guestItem of guestItems) {
                const existingIndex = mergedItems.findIndex((item) => String(item.productId) === String(guestItem.productId));
                if (existingIndex !== -1) {
                    mergedItems[existingIndex].quantity += guestItem.quantity;
                }
                else {
                    mergedItems.push(guestItem);
                }
            }
            await prisma_1.prisma.cart.update({
                where: { userId: userId },
                data: { items: mergedItems },
            });
        }
        else {
            await prisma_1.prisma.cart.create({
                data: {
                    userId: userId,
                    items: guestItems,
                },
            });
        }
        await prisma_1.prisma.cart.delete({
            where: { guestId: guestId },
        });
    }
    catch (error) {
        logger_1.log.error('Cart merge failed', { error: error instanceof Error ? error.message : 'unknown' });
    }
};
// ============================================================
// POST /api/orders — СОЗДАНИЕ ЗАКАЗА
// ============================================================
const createOrderController = async (req, res) => {
    try {
        const userId = req.user?.id;
        const guestId = req.query.guestId || req.cookies?.guestId;
        if (!userId) {
            res.status(401).json({ error: 'Необходимо авторизоваться' });
            return;
        }
        const paymentMethod = req.body.paymentMethod ?? 'online';
        if (!['online', 'bank_invoice'].includes(paymentMethod)
            || (paymentMethod === 'bank_invoice' && !invoice_schema_1.requestInvoiceSchema.safeParse({ buyer: req.body.invoiceBuyer }).success)
            || (paymentMethod === 'online' && req.body.invoiceBuyer !== undefined)) {
            res.status(400).json({ code: 'INVALID_PAYMENT_METHOD', error: 'Проверьте способ оплаты и реквизиты покупателя' });
            return;
        }
        const offer = (0, consent_service_1.offerEvidence)(req.body.offerAcceptance);
        await (0, consent_service_1.ensurePersonalDataConsent)(prisma_1.prisma, userId, req.body.personalDataConsent, false);
        if (guestId) {
            await mergeCart(userId, guestId);
            res.clearCookie('guestId', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }
        const { client, deliveryMethod, deliveryAddress, deliveryProvider, contactMethod, comment, } = req.body;
        const allowedContactMethods = new Set(['phone', 'max', 'telegram', 'email']);
        const normalizedContactMethod = allowedContactMethods.has(contactMethod) ? contactMethod : 'phone';
        if (!client?.firstName || !client?.lastName || !client?.phone || !client?.email) {
            res.status(400).json({ error: 'Укажите имя, фамилию, телефон и email покупателя' });
            return;
        }
        const cart = await getCartWithTotal(userId);
        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            res.status(400).json({ error: 'Корзина пуста' });
            return;
        }
        const validatedCart = await (0, checkoutInventory_service_1.validateCheckoutItems)(cart.items);
        // Создание заказа и очистка корзины атомарны. Serializable не позволяет
        // двум параллельным checkout-запросам создать заказы из одного snapshot.
        let localOrder;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                localOrder = await prisma_1.prisma.$transaction(async (tx) => {
                    const currentCart = await tx.cart.findUnique({ where: { id: cart.id } });
                    const currentItems = safeItems(currentCart?.items);
                    if (!currentCart || JSON.stringify(currentItems) !== JSON.stringify(cart.items)) {
                        throw new checkoutInventory_service_1.CheckoutInventoryError('Корзина изменилась во время оформления. Повторите попытку', 409, 'CART_CHANGED');
                    }
                    const consent = await (0, consent_service_1.ensurePersonalDataConsent)(tx, userId, req.body.personalDataConsent, true);
                    const order = await tx.order.create({
                        data: {
                            userId: userId,
                            ...offer,
                            personalDataConsentId: consent.id,
                            customerFirstName: String(client.firstName).trim(),
                            customerLastName: String(client.lastName).trim(),
                            customerMiddleName: client.middleName ? String(client.middleName).trim() : null,
                            customerPhone: String(client.phone).trim(),
                            customerEmail: String(client.email).trim().toLowerCase(),
                            contactMethod: normalizedContactMethod,
                            items: validatedCart.items,
                            total: validatedCart.total,
                            status: 'pending',
                            paymentMethod,
                            deliveryMethod: deliveryMethod || 'pickup',
                            deliveryAddress: deliveryAddress || null,
                            deliveryProvider: deliveryMethod === 'post' ? (deliveryProvider || null) : null,
                            comment: comment || null,
                        },
                    });
                    const invoice = paymentMethod === 'bank_invoice'
                        ? await (0, invoice_service_1.prepareCheckoutInvoice)(tx, order, req.body.invoiceBuyer) : null;
                    await tx.cart.update({
                        where: { id: cart.id },
                        data: { items: [] },
                    });
                    const customerName = [
                        order.customerFirstName,
                        order.customerMiddleName,
                        order.customerLastName,
                    ].filter(Boolean).join(' ') || 'Клиент';
                    const emailItems = validatedCart.items.map((item) => ({
                        name: item.name || 'Товар',
                        quantity: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity,
                    }));
                    await Promise.all([
                        ...(paymentMethod === 'online' ? [(0, email_service_1.sendOrderCreatedToCustomer)({
                                orderId: order.id,
                                customerName,
                                customerEmail: order.customerEmail || '',
                                total: order.total,
                                documentNumber: order.orderNumber || order.id,
                                createdAt: order.createdAt,
                                items: emailItems,
                                deliveryMethod: order.deliveryMethod,
                                deliveryAddress: order.deliveryAddress || '',
                                deliveryProvider: order.deliveryProvider || '',
                                offerVersion: order.offerVersion,
                            }, tx)] : []),
                        (0, email_service_1.sendOrderNotificationToManager)({
                            orderId: order.id,
                            documentNumber: order.id.slice(0, 8),
                            customerName,
                            customerEmail: order.customerEmail || '',
                            customerPhone: order.customerPhone || '',
                            total: order.total,
                            items: emailItems,
                            deliveryAddress: order.deliveryAddress || '',
                            comment: order.comment || '',
                        }, tx),
                    ]);
                    return { ...order, invoice };
                }, { isolationLevel: 'Serializable' });
                break;
            }
            catch (error) {
                if (!isSerializableConflict(error))
                    throw error;
                if (attempt === 2) {
                    throw new checkoutInventory_service_1.CheckoutInventoryError('Корзина уже оформляется другим запросом. Повторите попытку', 409, 'CHECKOUT_CONFLICT');
                }
            }
        }
        res.status(201).json({
            success: true,
            order: {
                ...(0, invoice_service_1.orderWithPaymentView)(localOrder),
                id: localOrder.id,
                total: localOrder.total,
                status: localOrder.status,
            },
            message: 'Заказ создан, ожидает обработки'
        });
    }
    catch (error) {
        logger_1.log.error('Order creation failed', { error: error instanceof Error ? error.message : 'unknown' });
        if (error instanceof invoice_service_1.InvoiceError) {
            res.status(error.status).json({ code: error.code, error: error.message });
            return;
        }
        if (error instanceof error_middleware_1.AppError) {
            res.status(error.statusCode).json({ code: error.code, error: error.message });
            return;
        }
        if (error instanceof checkoutInventory_service_1.CheckoutInventoryError) {
            res.status(error.status).json({
                error: error.message,
                code: error.code,
                ...(error.details || {}),
            });
            return;
        }
        res.status(500).json({ code: 'ORDER_CREATE_FAILED', error: 'Не удалось создать заказ. Попробуйте ещё раз позже' });
    }
};
exports.createOrderController = createOrderController;
// ============================================================
// GET /api/orders/:id — ПОЛУЧЕНИЕ ЗАКАЗА
// ============================================================
const getOrderController = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const order = await prisma_1.prisma.order.findFirst({
            where: {
                id: id,
                userId: userId,
            },
            include: {
                invoice: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        middleName: true,
                        email: true,
                        phone: true,
                    }
                },
                paymentAttempts: {
                    select: {
                        status: true,
                        providerPaymentId: true,
                        providerRequestStartedAt: true,
                        reservationId: true,
                        lastCheckedAt: true,
                        refundReason: true,
                        refundRequestedAt: true,
                        refundedAt: true,
                    },
                    take: 1,
                },
            }
        });
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        res.json({ order: await (0, invoice_service_1.loadOrderPaymentView)(order) });
    }
    catch (error) {
        logger_1.log.error('Order lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ code: 'ORDER_LOAD_FAILED', error: 'Не удалось загрузить заказ' });
    }
};
exports.getOrderController = getOrderController;
// ============================================================
// GET /api/orders — ВСЕ ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const getUserOrdersController = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orders = await prisma_1.prisma.order.findMany({
            where: { userId },
            include: {
                invoice: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        middleName: true,
                    }
                },
                paymentAttempts: {
                    select: {
                        status: true,
                        providerPaymentId: true,
                        providerRequestStartedAt: true,
                        reservationId: true,
                        lastCheckedAt: true,
                        refundReason: true,
                        refundRequestedAt: true,
                        refundedAt: true,
                    },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ orders: await Promise.all(orders.map(invoice_service_1.loadOrderPaymentView)) });
    }
    catch (error) {
        logger_1.log.error('Order list failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ code: 'ORDER_LOAD_FAILED', error: 'Не удалось загрузить заказы' });
    }
};
exports.getUserOrdersController = getUserOrdersController;
// ============================================================
// DELETE /api/orders/:id — legacy physical delete is retired
// ============================================================
const deleteOrderController = async (req, res) => {
    res.status(405).json({
        error: 'Физическое удаление заказа недоступно. Используйте запрос отмены.',
        cancellationEndpoint: `/api/orders/${req.params.id}/cancellation`,
    });
};
exports.deleteOrderController = deleteOrderController;
const requestOrderCancellationController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Необходимо авторизоваться' });
            return;
        }
        const order = await (0, orderCancellation_service_1.requestOrderCancellation)(req.params.id, userId, req.body?.reason);
        res.status(order?.cancellationState === 'requested' ? 202 : 200).json({ success: true, order: order ? await (0, invoice_service_1.loadOrderPaymentView)(order) : order });
    }
    catch (error) {
        if (error instanceof orderCancellation_service_1.OrderCancellationError) {
            res.status(error.statusCode).json({ code: error.code, error: error.message });
            return;
        }
        logger_1.log.error('Order cancellation request failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Не удалось запросить отмену заказа' });
    }
};
exports.requestOrderCancellationController = requestOrderCancellationController;
//# sourceMappingURL=order.controller.js.map