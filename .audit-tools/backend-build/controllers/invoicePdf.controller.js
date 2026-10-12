"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadInvoicePdf = downloadInvoicePdf;
const prisma_1 = require("../config/prisma");
const invoicePdf_service_1 = require("../services/invoicePdf.service");
async function downloadInvoicePdf(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Необходима авторизация' });
        return;
    }
    try {
        const order = await prisma_1.prisma.order.findFirst({ where: { id: req.params.id, userId }, include: { invoice: true } });
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        if (order.invoice?.documentStatus !== 'issued' || !order.invoice.issuedAt) {
            res.status(409).json({ error: 'Счёт ещё не выпущен или отменён' });
            return;
        }
        const pdf = await (0, invoicePdf_service_1.renderInvoicePdf)(order.invoice);
        const filename = `invoice-${order.invoice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(pdf);
    }
    catch {
        res.status(500).json({ error: 'Не удалось сформировать счёт' });
    }
}
//# sourceMappingURL=invoicePdf.controller.js.map