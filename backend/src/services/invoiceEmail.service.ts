import { Prisma } from '@prisma/client';
import { persistEmailEvent } from './emailOutbox.service';
import { invoiceIssuedCustomerTemplate } from './emailTemplates';
import { invoiceDate, invoiceMoney } from './invoicePdf.service';

/** Called inside the same transaction that first issues the immutable Invoice. */
export async function persistInvoiceIssuedEmail(tx: Prisma.TransactionClient, invoice: any) {
  if (invoice.documentStatus !== 'issued' || !invoice.issuedAt) throw new Error('Invoice must be issued before email');
  const template = invoiceIssuedCustomerTemplate({ orderId: invoice.orderId, orderNumber: invoice.orderNumberSnapshot,
    invoiceNumber: invoice.invoiceNumber, amount: invoiceMoney(invoice.amountMinor), dueDate: invoiceDate(invoice.dueAt),
    vatLabel: invoice.sellerSnapshot.vatLabel });
  return persistEmailEvent(tx, { aggregateId: invoice.orderId, eventType: 'invoice_issued',
    deduplicationKey: `invoice-issued:${invoice.id}`, payload: { to: invoice.buyerSnapshot.email, ...template } });
}
