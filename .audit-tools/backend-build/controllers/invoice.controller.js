"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestInvoiceController = exports.getInvoiceStateController = void 0;
const prisma_1 = require("../config/prisma");
const logger_1 = require("../config/logger");
const invoice_service_1 = require("../services/invoice.service");
const orderPaymentView_service_1 = require("../services/orderPaymentView.service");
async function loadOwnedOrder(orderId, userId) {
    return prisma_1.prisma.order.findFirst({
        where: { id: orderId, userId },
        include: { invoice: true, paymentAttempts: { take: 1 } },
    });
}
const getInvoiceStateController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Необходима авторизация' });
            return;
        }
        const order = await loadOwnedOrder(req.params.id, userId);
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        const view = (0, orderPaymentView_service_1.getOrderPaymentView)(order, order.paymentAttempts[0] || null, order.invoice, {
            reservationReleased: await (0, invoice_service_1.invoiceReservationReleased)(order),
        });
        res.json({ payment: view, invoice: (0, invoice_service_1.publicInvoice)(order.invoice) });
    }
    catch (error) {
        logger_1.log.error('Invoice state lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'Не удалось загрузить состояние оплаты' });
    }
};
exports.getInvoiceStateController = getInvoiceStateController;
const requestInvoiceController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Необходима авторизация' });
            return;
        }
        const invoice = await invoice_service_1.invoiceService.prepare(req.params.id, userId, req.body);
        const order = await loadOwnedOrder(req.params.id, userId);
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        const view = (0, orderPaymentView_service_1.getOrderPaymentView)(order, order.paymentAttempts[0] || null, order.invoice || invoice, {
            reservationReleased: await (0, invoice_service_1.invoiceReservationReleased)(order),
        });
        res.status(invoice.documentStatus === 'issued' ? 200 : 202).json({
            success: true,
            payment: view,
            invoice: (0, invoice_service_1.publicInvoice)(order.invoice || invoice),
        });
    }
    catch (error) {
        if (error instanceof invoice_service_1.InvoiceError) {
            res.status(error.status).json({ code: error.code, error: error.message });
            return;
        }
        logger_1.log.error('Invoice request failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ code: 'INVOICE_REQUEST_FAILED', error: 'Не удалось подготовить счёт' });
    }
};
exports.requestInvoiceController = requestInvoiceController;
//# sourceMappingURL=invoice.controller.js.map