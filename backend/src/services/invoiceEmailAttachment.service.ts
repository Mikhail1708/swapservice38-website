import { prisma } from '../config/prisma';
import { EmailJobData, BRAND_LOGO_ATTACHMENT, BRAND_LOGO_CID } from './emailAttachments';
import { renderInvoicePdf } from './invoicePdf.service';

/** Resolve only a persisted issued snapshot; never serialize PDF bytes into Bull/SQL. */
export async function resolveEmailAttachments(data: EmailJobData, jobId?: string | number) {
  const { invoiceAttachment, ...mail } = data;
  // Old retained jobs may still contain an absolute path from the previous image.
  if (mail.attachments) mail.attachments = mail.attachments.map(attachment =>
    attachment.cid === BRAND_LOGO_CID ? BRAND_LOGO_ATTACHMENT : attachment);
  let reference = invoiceAttachment;
  // Retained pre-upgrade Bull jobs have no attachment reference. Recover it from
  // their existing durable event, without creating a new event or resending mail.
  if (!reference && typeof jobId === 'string' && jobId.startsWith('email-outbox-')) {
    const event = await prisma.emailOutboxEvent.findUnique({ where: { id: jobId.slice('email-outbox-'.length) } });
    if (!event) throw new Error('EMAIL_OUTBOX_EVENT_NOT_FOUND');
    if (event.eventType === 'invoice_issued') {
      if (!event.deduplicationKey.startsWith('invoice-issued:')) throw new Error('INVOICE_EMAIL_REFERENCE_INVALID');
      reference = { invoiceId: event.deduplicationKey.slice('invoice-issued:'.length), orderId: event.aggregateId };
    }
  }
  if (!reference) return mail;
  if (typeof reference.invoiceId !== 'string' || !reference.invoiceId
    || typeof reference.orderId !== 'string' || !reference.orderId) throw new Error('INVOICE_EMAIL_REFERENCE_INVALID');
  const invoice = await prisma.invoice.findUnique({ where: { id: reference.invoiceId } });
  if (!invoice || invoice.orderId !== reference.orderId || invoice.documentStatus !== 'issued'
    || !invoice.issuedAt) throw new Error('INVOICE_EMAIL_NOT_ISSUED');
  const buyer = invoice.buyerSnapshot as { email?: string };
  if (buyer.email !== data.to) throw new Error('INVOICE_EMAIL_RECIPIENT_MISMATCH');
  const content = await renderInvoicePdf(invoice);
  const number = String(invoice.invoiceNumber).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
  return { ...mail, attachments: [...mail.attachments, {
    filename: `invoice-${number}.pdf`, contentType: 'application/pdf', content,
  }] };
}

/** Whitelist diagnostics; SMTP responses/messages can contain credentials or personal data. */
export function emailErrorDetails(error: unknown) {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const token = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : undefined;
  return { errorName: token(source.name) || 'Error', code: token(source.code),
    responseCode: typeof source.responseCode === 'number' ? source.responseCode : undefined,
    command: typeof source.command === 'string' ? /^(CONN|EHLO|HELO|AUTH|MAIL|RCPT|DATA|QUIT)\b/.exec(source.command)?.[1] : undefined };
}
