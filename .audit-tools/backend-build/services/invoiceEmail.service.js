"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistInvoiceIssuedEmail = persistInvoiceIssuedEmail;
const emailOutbox_service_1 = require("./emailOutbox.service");
const emailTemplates_1 = require("./emailTemplates");
const invoicePdf_service_1 = require("./invoicePdf.service");
/** Called inside the same transaction that first issues the immutable Invoice. */
async function persistInvoiceIssuedEmail(tx, invoice) {
    if (invoice.documentStatus !== 'issued' || !invoice.issuedAt)
        throw new Error('Invoice must be issued before email');
    const template = (0, emailTemplates_1.invoiceIssuedCustomerTemplate)({ orderId: invoice.orderId, orderNumber: invoice.orderNumberSnapshot,
        invoiceNumber: invoice.invoiceNumber, amount: (0, invoicePdf_service_1.invoiceMoney)(invoice.amountMinor), dueDate: (0, invoicePdf_service_1.invoiceDate)(invoice.dueAt),
        vatLabel: invoice.sellerSnapshot.vatLabel });
    return (0, emailOutbox_service_1.persistEmailEvent)(tx, { aggregateId: invoice.orderId, eventType: 'invoice_issued',
        deduplicationKey: `invoice-issued:${invoice.id}`, payload: { to: invoice.buyerSnapshot.email, ...template,
            invoiceAttachment: { invoiceId: invoice.id, orderId: invoice.orderId } } });
}
//# sourceMappingURL=invoiceEmail.service.js.map