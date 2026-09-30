import Queue from 'bull';
import nodemailer from 'nodemailer';
import { prisma } from '../../../src/config/prisma';
import { persistInvoiceIssuedEmail } from '../../../src/services/invoiceEmail.service';
import { resolveEmailAttachments, emailErrorDetails } from '../../../src/services/invoiceEmailAttachment.service';
import { createEmailJobData } from '../../../src/services/emailAttachments';

const emails = jest.requireActual('../../../src/services/email.service') as typeof import('../../../src/services/email.service');
const queue = (Queue as unknown as jest.Mock).mock.results[0].value;
const worker = queue.process.mock.calls[0][0];
const invoice = {
  id: 'invoice-mail-1', orderId: 'order-mail-1', documentStatus: 'issued', invoiceNumber: 'BI-2026-1',
  orderNumberSnapshot: 'WEB-1', issuedAt: new Date('2026-09-29'), dueAt: new Date('2026-10-02'),
  amountMinor: 12500n, currency: 'RUB', paymentPurpose: 'Оплата по счёту BI-2026-1. Без НДС.',
  sellerSnapshot: { legalName: 'ИП Старые реквизиты', inn: '381011379046', ogrnip: '315385000059546',
    legalAddress: 'Иркутск', settlementAccount: '40802810900000298096', bankName: 'АО ТБанк',
    bankBik: '044525974', bankInn: '7710140679', bankCorrespondentAccount: '30101810145250000974',
    bankAddress: 'Москва', vatLabel: 'Без НДС' },
  buyerSnapshot: { buyerType: 'legal_entity', legalName: 'ООО Покупатель', inn: '7707083893',
    legalAddress: 'Иркутск', contactName: 'Иван', phone: '+79991234567', email: 'buyer@example.test' },
  itemsSnapshot: [{ name: 'Товар из snapshot', sku: 'ABC-123', quantity: 1, unitPriceMinor: '12500', totalMinor: '12500' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(invoice);
  queue.token = 'test-owner'; queue.toKey = (id: string) => `bull:email:${id}`;
  queue.client = { eval: jest.fn().mockResolvedValue(1) };
});

it('persists one immutable reference, retries the same job and sends a real PDF through SMTP', async () => {
  const events = new Map();
  const tx = { emailOutboxEvent: { upsert: jest.fn(async ({ where, create }: any) => {
    if (!events.has(where.deduplicationKey)) events.set(where.deduplicationKey, create);
    return events.get(where.deduplicationKey);
  }) } };
  await persistInvoiceIssuedEmail(tx as any, invoice);
  await persistInvoiceIssuedEmail(tx as any, invoice);
  expect(events.size).toBe(1);
  const event = [...events.values()][0];
  expect(event.payload.subject).toContain('BI-2026-1');
  expect(event.payload.text).toContain('прикреплён');
  expect(event.payload.invoiceAttachment).toEqual({ invoiceId: invoice.id, orderId: invoice.orderId });
  await emails.enqueueOutboxEmail(event.payload, 'email-outbox-invoice-mail-1');
  const [data, opts] = queue.add.mock.calls[0];
  expect(opts.jobId).toBe('email-outbox-invoice-mail-1');
  const smtp = nodemailer.createTransport({}).sendMail as jest.Mock;
  smtp.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
  await expect(worker({ data })).rejects.toThrow('timeout');
  await worker({ data });
  expect(events.size).toBe(1);
  for (const [mail] of smtp.mock.calls) {
    expect(mail.invoiceAttachment).toBeUndefined();
    const pdf = mail.attachments.find((a: any) => a.contentType === 'application/pdf');
    expect(pdf.filename).toBe('invoice-BI-2026-1.pdf');
    expect(Buffer.isBuffer(pdf.content)).toBe(true);
    expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.content.length).toBeGreaterThan(10000);
  }
  expect(prisma.invoice.findUnique).toHaveBeenCalledWith({ where: { id: invoice.id } });
});

it.each(['preparing', 'cancelled'])('does not send non-issued %s invoice', async documentStatus => {
  (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ ...invoice, documentStatus });
  await expect(resolveEmailAttachments({ ...createEmailJobData(invoice.buyerSnapshot.email, 'Invoice', 'Invoice'),
    invoiceAttachment: { invoiceId: invoice.id, orderId: invoice.orderId } })).rejects.toThrow('INVOICE_EMAIL_NOT_ISSUED');
});

it('upgrades a pending legacy job using its existing durable invoice event', async () => {
  (prisma.emailOutboxEvent.findUnique as jest.Mock).mockResolvedValue({
    eventType: 'invoice_issued', aggregateId: invoice.orderId, deduplicationKey: `invoice-issued:${invoice.id}`,
  });
  const mail = await resolveEmailAttachments(createEmailJobData(invoice.buyerSnapshot.email, 'Invoice', 'Invoice'), 'email-outbox-legacy');
  expect(mail.attachments.some((attachment: any) => attachment.contentType === 'application/pdf')).toBe(true);
  expect(prisma.emailOutboxEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'legacy' } });
});

it('rejects a mismatched recipient and logs only whitelisted SMTP diagnostics', async () => {
  await expect(resolveEmailAttachments({ ...createEmailJobData('other@example.test', 'Invoice', 'Invoice'),
    invoiceAttachment: { invoiceId: invoice.id, orderId: invoice.orderId } })).rejects.toThrow('INVOICE_EMAIL_RECIPIENT_MISMATCH');
  expect(emailErrorDetails({ name: 'Error', code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN secret',
    response: 'credentials secret', message: 'password secret' })).toEqual({ errorName: 'Error', code: 'EAUTH', responseCode: 535, command: 'AUTH' });
});
