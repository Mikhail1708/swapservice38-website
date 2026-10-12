"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryOrderToCRM = exports.deleteOrderWithPassword = exports.massDeleteOrdersWithPassword = exports.massDeleteOrders = exports.deleteOrder = exports.updateOrder = exports.retryFailedRefund = exports.updateOrderStatus = exports.getOrderById = exports.getOrders = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("../../config/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const crm_queue_1 = require("../../queues/crm.queue");
const crmOrderPayload_service_1 = require("../../services/crmOrderPayload.service");
const paymentSafety_1 = require("../../utils/paymentSafety");
const crmOutbox_service_1 = require("../../services/crmOutbox.service");
const paymentWorkflowLock_service_1 = require("../../services/paymentWorkflowLock.service");
const prisma_1 = require("../../config/prisma");
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
const PAYMENT_STARTED_DELETE_MESSAGE = 'Нельзя удалить заказ после начала оплаты';
const deletableOrderStatusesWithoutPassword = () => ['pending', 'crm_failed'];
const deletableOrderStatusesWithPassword = (role) => (role === 'admin'
    ? ['pending', 'crm_failed', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']
    : ['pending', 'crm_failed']);
const deleteOrdersWithReasons = async (rawIds, allowedStatuses) => {
    const ids = [...new Set(rawIds.filter((id) => typeof id === 'string' && id.length > 0))];
    const orders = await prisma_1.prisma.order.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            status: true,
            paymentId: true,
            paymentAttempts: { select: { id: true }, take: 1 },
        },
    });
    const byId = new Map(orders.map((order) => [order.id, order]));
    const skipped = [];
    const eligible = [];
    for (const id of ids) {
        const order = byId.get(id);
        if (!order) {
            skipped.push({ id, code: 'NOT_FOUND', reason: 'Заказ не найден' });
        }
        else if (!allowedStatuses.includes(order.status)) {
            skipped.push({ id, code: 'STATUS_NOT_ALLOWED', reason: `Нельзя удалить заказ в статусе ${order.status}` });
        }
        else if (order.paymentId || order.paymentAttempts.length > 0) {
            skipped.push({ id, code: 'PAYMENT_STARTED', reason: PAYMENT_STARTED_DELETE_MESSAGE });
        }
        else {
            eligible.push(id);
        }
    }
    if (eligible.length === 0)
        return { deleted: 0, skipped };
    const result = await prisma_1.prisma.order.deleteMany({
        where: {
            id: { in: eligible },
            status: { in: allowedStatuses },
            ...paymentSafety_1.noStartedPaymentWhere,
        },
    });
    if (result.count !== eligible.length) {
        const remaining = await prisma_1.prisma.order.findMany({
            where: { id: { in: eligible } },
            select: {
                id: true,
                paymentId: true,
                paymentAttempts: { select: { id: true }, take: 1 },
            },
        });
        const remainingById = new Map(remaining.map((order) => [order.id, order]));
        for (const id of eligible) {
            const order = remainingById.get(id);
            skipped.push(order && (order.paymentId || order.paymentAttempts.length > 0)
                ? { id, code: 'PAYMENT_STARTED', reason: PAYMENT_STARTED_DELETE_MESSAGE }
                : { id, code: 'STATE_CHANGED', reason: 'Состояние заказа изменилось, удаление не выполнено' });
        }
    }
    return { deleted: result.count, skipped };
};
// ============================================================
// GET /api/admin/orders — список заказов
// ============================================================
const getOrders = async (req, res) => {
    try {
        const { page = '1', limit = '20', search, status } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { guestName: { contains: search, mode: 'insensitive' } },
                { guestPhone: { contains: search, mode: 'insensitive' } },
                { guestEmail: { contains: search, mode: 'insensitive' } },
                { customerFirstName: { contains: search, mode: 'insensitive' } },
                { customerLastName: { contains: search, mode: 'insensitive' } },
                { customerPhone: { contains: search, mode: 'insensitive' } },
                { customerEmail: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status) {
            where.status = status;
        }
        logger_1.log.debug('📋 GET /api/admin/orders', { page: pageNum, limit: limitNum, search, status });
        const [orders, total] = await Promise.all([
            prisma_1.prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { _count: { select: { paymentAttempts: true } } },
            }),
            prisma_1.prisma.order.count({ where }),
        ]);
        logger_1.log.debug(`✅ Найдено ${orders.length} заказов, всего ${total}`);
        res.json({
            orders: orders.map((o) => {
                const { _count, ...order } = o;
                return {
                    ...order,
                    paymentStarted: Boolean(o.paymentId || _count.paymentAttempts > 0),
                    guestName: o.guestName || [o.customerLastName, o.customerFirstName, o.customerMiddleName].filter(Boolean).join(' ') || 'Гость',
                    guestPhone: o.guestPhone || o.customerPhone,
                    guestEmail: o.guestEmail || o.customerEmail,
                    customerName: [o.customerLastName, o.customerFirstName, o.customerMiddleName].filter(Boolean).join(' ') || o.guestName || 'Гость',
                };
            }),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        logger_1.log.error('❌ Get orders error', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка получения заказов', 500);
    }
};
exports.getOrders = getOrders;
// ============================================================
// GET /api/admin/orders/:id — получить заказ
// ============================================================
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!order) {
            throw new error_middleware_1.NotFoundError('Заказ не найден');
        }
        res.json({
            order: {
                ...order,
                paymentStarted: Boolean(order.paymentId || order.paymentAttempts.length > 0),
                guestName: order.guestName || [order.customerLastName, order.customerFirstName, order.customerMiddleName].filter(Boolean).join(' '),
                guestPhone: order.guestPhone || order.customerPhone,
                guestEmail: order.guestEmail || order.customerEmail,
            },
        });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Get order error', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка получения заказа', 500);
    }
};
exports.getOrderById = getOrderById;
// ============================================================
// PATCH /api/admin/orders/:id/status — обновить статус
// ============================================================
const updateOrderStatus = async (req, res) => {
    res.status(410).json({
        error: 'Lifecycle status управляется CRM и доступен на сайте только для чтения',
    });
};
exports.updateOrderStatus = updateOrderStatus;
const retryFailedRefund = async (req, res) => {
    try {
        const replay = await (0, crmOutbox_service_1.replayFailedPaymentRefund)(req.params.id);
        await (0, crmOutbox_service_1.dispatchPaymentRefundEvent)(replay.outboxEvent.id).catch(() => false);
        res.json({ success: true, ...replay });
    }
    catch (error) {
        throw new error_middleware_1.AppError(error?.message || 'Refund replay failed', 409);
    }
};
exports.retryFailedRefund = retryFailedRefund;
// ============================================================
// PUT /api/admin/orders/:id — ПОЛНОЕ ОБНОВЛЕНИЕ ЗАКАЗА
// ============================================================
const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestName, guestPhone, guestEmail, deliveryAddress, deliveryProvider, contactMethod, comment, deliveryMethod, items, } = req.body;
        logger_1.log.info(`📝 Обновление заказа ${id}`);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: {
                user: {
                    select: { firstName: true, lastName: true, middleName: true, phone: true, email: true },
                },
            },
        });
        if (!order) {
            throw new error_middleware_1.NotFoundError('Заказ не найден');
        }
        if (!order.crmOrderId) {
            throw new error_middleware_1.AppError('Заказ ещё не синхронизирован с CRM, редактирование недоступно', 400);
        }
        const updatedOrder = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                guestName: guestName !== undefined ? guestName : order.guestName,
                guestPhone: guestPhone !== undefined ? guestPhone : order.guestPhone,
                guestEmail: guestEmail !== undefined ? guestEmail : order.guestEmail,
                deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : order.deliveryAddress,
                deliveryProvider: deliveryProvider !== undefined ? deliveryProvider : order.deliveryProvider,
                contactMethod: contactMethod !== undefined ? contactMethod : order.contactMethod,
                comment: comment !== undefined ? comment : order.comment,
                deliveryMethod: deliveryMethod || order.deliveryMethod,
                items: items || order.items,
                updatedAt: new Date(),
            },
        });
        try {
            const completePayload = (0, crmOrderPayload_service_1.buildCrmOrderPayload)({ ...updatedOrder, user: order.user });
            const crmPayload = {
                clientData: {
                    ...completePayload.client,
                },
                description: completePayload.comment,
                deliveryMethod: completePayload.deliveryMethod,
                deliveryAddress: completePayload.deliveryAddress,
                deliveryProvider: completePayload.deliveryProvider,
                contactMethod: completePayload.contactMethod,
                items: completePayload.items,
            };
            await (0, crm_queue_1.addUpdateToCRMQueue)(updatedOrder.id, order.crmOrderId, crmPayload);
            logger_1.log.info(`📤 Обновление заказа ${id} добавлено в очередь CRM`);
        }
        catch (crmError) {
            logger_1.log.error('❌ Ошибка постановки обновления в очередь CRM', { error: crmError.message });
        }
        logger_1.log.info(`✅ Заказ ${id} обновлён`);
        res.json({ success: true, order: updatedOrder });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Ошибка обновления заказа', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка обновления заказа', 500);
    }
};
exports.updateOrder = updateOrder;
// ============================================================
// ✅ DELETE /api/admin/orders/:id — УДАЛЕНИЕ
// ============================================================
const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        logger_1.log.info(`🗑️ Удаление заказа ${id}`);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
        });
        if (!order) {
            throw new error_middleware_1.NotFoundError('Заказ не найден');
        }
        // Без пароля физическое удаление разрешено только для pre-handoff статусов.
        const allowedStatuses = deletableOrderStatusesWithoutPassword();
        if (!allowedStatuses.includes(order.status)) {
            throw new error_middleware_1.AppError(`Нельзя удалить заказ в статусе ${order.status}`, 400);
        }
        const deleted = await prisma_1.prisma.order.deleteMany({
            where: { id, ...paymentSafety_1.noStartedPaymentWhere },
        });
        if (deleted.count !== 1) {
            throw new error_middleware_1.AppError(PAYMENT_STARTED_DELETE_MESSAGE, 409);
        }
        logger_1.log.info(`🗑️ Заказ ${id} удалён`);
        res.json({ success: true, message: 'Заказ удалён' });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Delete order error', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка удаления заказа', 500);
    }
};
exports.deleteOrder = deleteOrder;
// ============================================================
// ✅ POST /api/admin/orders/mass-delete — МАССОВОЕ УДАЛЕНИЕ
// ============================================================
const massDeleteOrders = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'Не указаны ID заказов' });
            return;
        }
        logger_1.log.info(`🗑️ Массовое удаление заказов: ${ids.length} шт.`);
        // Без пароля физическое удаление разрешено только для pre-handoff статусов.
        const allowedStatuses = deletableOrderStatusesWithoutPassword();
        const result = await deleteOrdersWithReasons(ids, allowedStatuses);
        logger_1.log.info(`🗑️ Удалено ${result.deleted} заказов, пропущено ${result.skipped.length}`);
        res.json({
            success: result.skipped.length === 0,
            deleted: result.deleted,
            skipped: result.skipped,
            message: `Удалено ${result.deleted} заказов${result.skipped.length ? `, пропущено ${result.skipped.length}` : ''}`,
        });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Mass delete orders error', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка массового удаления', 500);
    }
};
exports.massDeleteOrders = massDeleteOrders;
// ============================================================
// ✅ POST /api/admin/orders/mass-delete-with-password — МАССОВОЕ УДАЛЕНИЕ С ПАРОЛЕМ
// ============================================================
const massDeleteOrdersWithPassword = async (req, res) => {
    try {
        const { ids, password } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'Не указаны ID заказов' });
            return;
        }
        if (!password) {
            res.status(400).json({ error: 'Требуется ввод пароля' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new error_middleware_1.UnauthorizedError('Не авторизован');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true, role: true },
        });
        if (!user) {
            throw new error_middleware_1.UnauthorizedError('Пользователь не найден');
        }
        // ✅ ПРОВЕРЯЕМ ПАРОЛЬ
        const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new error_middleware_1.AppError('Неверный пароль', 401);
        }
        // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
        const allowedStatuses = deletableOrderStatusesWithPassword(user.role);
        logger_1.log.info(`🗑️ Массовое удаление заказов с паролем: ${ids.length} шт. (роль: ${user.role})`);
        const result = await deleteOrdersWithReasons(ids, allowedStatuses);
        logger_1.log.info(`🗑️ Удалено ${result.deleted} заказов пользователем ${userId}, пропущено ${result.skipped.length}`);
        res.json({
            success: result.skipped.length === 0,
            deleted: result.deleted,
            skipped: result.skipped,
            message: `Удалено ${result.deleted} заказов${result.skipped.length ? `, пропущено ${result.skipped.length}` : ''}`,
        });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Mass delete orders with password error', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка массового удаления', 500);
    }
};
exports.massDeleteOrdersWithPassword = massDeleteOrdersWithPassword;
// ============================================================
// DELETE /api/admin/orders/:id — УДАЛЕНИЕ С ПАРОЛЕМ
// ============================================================
const deleteOrderWithPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        logger_1.log.info(`🗑️ Запрос на удаление заказа ${id} с паролем`);
        if (!password) {
            throw new error_middleware_1.AppError('Требуется ввод пароля', 400);
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new error_middleware_1.UnauthorizedError('Не авторизован');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true, role: true },
        });
        if (!user) {
            throw new error_middleware_1.UnauthorizedError('Пользователь не найден');
        }
        if (user.role !== 'admin' && user.role !== 'manager') {
            throw new error_middleware_1.ForbiddenError('Доступ запрещён. Требуется роль admin или manager');
        }
        const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new error_middleware_1.AppError('Неверный пароль', 401);
        }
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
        });
        if (!order) {
            throw new error_middleware_1.NotFoundError('Заказ не найден');
        }
        // ✅ АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБЫЕ ЗАКАЗЫ, МЕНЕДЖЕР — ТОЛЬКО PENDING И CRM_FAILED
        const allowedStatuses = deletableOrderStatusesWithPassword(user.role);
        if (!allowedStatuses.includes(order.status)) {
            throw new error_middleware_1.AppError(`Нельзя удалить заказ в статусе ${order.status}`, 400);
        }
        const deleted = await prisma_1.prisma.order.deleteMany({
            where: { id, ...paymentSafety_1.noStartedPaymentWhere },
        });
        if (deleted.count !== 1) {
            throw new error_middleware_1.AppError(PAYMENT_STARTED_DELETE_MESSAGE, 409);
        }
        logger_1.log.info(`🗑️ Заказ ${id} удалён пользователем ${userId}`);
        res.json({
            success: true,
            message: 'Заказ успешно удалён',
        });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Ошибка удаления заказа', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка удаления заказа', 500);
    }
};
exports.deleteOrderWithPassword = deleteOrderWithPassword;
// ============================================================
// POST /api/admin/orders/:id/retry — ПОВТОРНАЯ ОТПРАВКА В CRM
// ============================================================
const retryOrderToCRM = async (req, res) => {
    try {
        const { id } = req.params;
        logger_1.log.info(`🔄 Повторная отправка заказа ${id} в CRM`);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
        });
        if (!order) {
            throw new error_middleware_1.NotFoundError('Заказ не найден');
        }
        if (order.crmOrderId) {
            throw new error_middleware_1.AppError('Заказ уже отправлен в CRM', 400);
        }
        if (order.status !== 'paid' && order.status !== 'crm_failed') {
            throw new error_middleware_1.AppError(`Заказ в статусе ${order.status} нельзя отправить в CRM`, 400);
        }
        const reconciliation = await prisma_1.prisma.$transaction(async (tx) => {
            await (0, paymentWorkflowLock_service_1.lockPaymentWorkflowOrder)(tx, id);
            const currentOrder = await tx.order.findUnique({ where: { id } });
            if (!currentOrder || currentOrder.crmOrderId) {
                throw new error_middleware_1.AppError('Заказ уже обработан или не найден', 409);
            }
            if (currentOrder.status !== 'paid' && currentOrder.status !== 'crm_failed') {
                throw new error_middleware_1.AppError('Состояние заказа изменилось', 409);
            }
            const attempt = await tx.paymentAttempt.findUnique({ where: { orderId: id } });
            if (!attempt?.providerPaymentId || !attempt.reservationId) {
                throw new error_middleware_1.AppError('Для заказа нет durable payment reservation', 409);
            }
            const refund = await tx.outboxEvent.findUnique({
                where: { deduplicationKey: (0, crmOutbox_service_1.paymentRefundDeduplicationKey)(attempt.providerPaymentId) },
            });
            if (refund)
                throw new error_middleware_1.AppError('Для заказа уже запущен durable refund workflow', 409);
            const original = await tx.outboxEvent.findUnique({
                where: { deduplicationKey: (0, crmOutbox_service_1.crmCreateDeduplicationKey)(id) },
            });
            const immutableOrderData = original?.payload?.orderData;
            if (!immutableOrderData)
                throw new error_middleware_1.AppError('Immutable CRM payload не найден', 409);
            const event = await (0, crmOutbox_service_1.ensurePaymentReconciliationEvent)(tx, id, attempt.providerPaymentId, immutableOrderData);
            await (0, crmOutbox_service_1.acceleratePaymentReconciliationEvent)(tx, event.id);
            return event;
        });
        // Best-effort acceleration only; PostgreSQL remains the recovery source.
        await (0, crmOutbox_service_1.dispatchPaymentReconciliationEvent)(reconciliation.id).catch(() => false);
        logger_1.log.info(`✅ Заказ ${id} добавлен в очередь для повторной отправки`);
        res.json({
            success: true,
            message: 'Заказ добавлен в очередь для повторной отправки',
        });
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError)
            throw error;
        logger_1.log.error('❌ Ошибка повторной отправки заказа', { error: error.message });
        throw new error_middleware_1.AppError('Ошибка повторной отправки заказа', 500);
    }
};
exports.retryOrderToCRM = retryOrderToCRM;
//# sourceMappingURL=orders.controller.js.map