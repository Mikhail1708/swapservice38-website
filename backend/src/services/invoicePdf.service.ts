import PDFDocument from 'pdfkit';
import path from 'path';

/** Rendering accepts only the persisted Invoice, never Product, profile or seller config. */
export function invoiceDocumentData(invoice: any) {
  if (invoice?.documentStatus !== 'issued' || !invoice.issuedAt || !invoice.dueAt
    || !invoice.invoiceNumber || !invoice.orderNumberSnapshot || !invoice.paymentPurpose
    || !invoice.sellerSnapshot || !invoice.buyerSnapshot || !Array.isArray(invoice.itemsSnapshot)) {
    throw new Error('INVOICE_NOT_ISSUED');
  }
  const amount = BigInt(invoice.amountMinor);
  let total = 0n;
  for (const item of invoice.itemsSnapshot) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0
      || !/^\d+$/.test(item.unitPriceMinor) || !/^\d+$/.test(item.totalMinor)
      || BigInt(item.unitPriceMinor) * BigInt(item.quantity) !== BigInt(item.totalMinor)) {
      throw new Error('INVOICE_SNAPSHOT_INVALID');
    }
    total += BigInt(item.totalMinor);
  }
  if (!invoice.itemsSnapshot.length || total !== amount || amount <= 0n || invoice.currency !== 'RUB') {
    throw new Error('INVOICE_AMOUNT_MISMATCH');
  }
  return { invoiceNumber: invoice.invoiceNumber as string, orderNumber: invoice.orderNumberSnapshot as string,
    issuedAt: new Date(invoice.issuedAt), dueAt: new Date(invoice.dueAt), amountMinor: amount,
    seller: invoice.sellerSnapshot, buyer: invoice.buyerSnapshot, items: invoice.itemsSnapshot,
    paymentPurpose: invoice.paymentPurpose as string };
}

export const invoiceMoney = (minor: bigint | string): string => {
  const value = BigInt(minor);
  return `${(value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${(value % 100n).toString().padStart(2, '0')} ₽`;
};
export const invoiceDate = (date: Date | string): string => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Irkutsk', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(date));

export async function renderInvoicePdf(invoice: any): Promise<Buffer> {
  const data = invoiceDocumentData(invoice);
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true,
    info: { Title: `Счёт на оплату №${data.invoiceNumber}`, Author: data.seller.legalName,
      CreationDate: data.issuedAt, ModDate: data.issuedAt } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.font(path.resolve(__dirname, '../../assets/fonts/NotoSans.ttf'));
  const width = doc.page.width - 84;
  const bottom = doc.page.height - 62;
  const clean = (value: unknown) => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const space = (height: number) => { if (doc.y + height > bottom) doc.addPage(); };
  const text = (value: string, size = 9) => {
    doc.fontSize(size).fillColor('#16202b');
    const height = doc.heightOfString(clean(value), { width });
    space(height + 5);
    doc.text(clean(value), 42, doc.y, { width, lineGap: 2 });
    doc.y += 5;
  };
  text(`СЧЁТ НА ОПЛАТУ №${data.invoiceNumber}`, 17);
  text(`Дата: ${invoiceDate(data.issuedAt)}     Срок оплаты: ${invoiceDate(data.dueAt)}`, 10);
  text(`Заказ №${data.orderNumber}`, 10);
  doc.y += 7;
  text('ПРОДАВЕЦ', 11);
  const s = data.seller;
  text(`${s.legalName}\nИНН ${s.inn}   ОГРНИП ${s.ogrnip}\n${s.legalAddress}`);
  text(`Расчётный счёт: ${s.settlementAccount}\nБанк: ${s.bankName}\nБИК: ${s.bankBik}   ИНН банка: ${s.bankInn}\nКорреспондентский счёт: ${s.bankCorrespondentAccount}\nАдрес банка: ${s.bankAddress}`);
  text('ПОКУПАТЕЛЬ', 11);
  const b = data.buyer;
  text(`${b.legalName}\nИНН ${b.inn}${b.kpp ? `   КПП ${b.kpp}` : ''}\n${b.legalAddress}\nКонтактное лицо: ${b.contactName}\nТелефон: ${b.phone}   Email: ${b.email}`);
  doc.y += 7;
  const widths = [25, 245, 45, 98, width - 413];
  const row = (cells: string[], header = false) => {
    doc.fontSize(8);
    const height = Math.max(24, ...cells.map((cell, i) => doc.heightOfString(clean(cell), { width: widths[i] - 10 }) + 14));
    if (doc.y + height > bottom) { doc.addPage(); if (!header) row(['№', 'Товар', 'Кол-во', 'Цена', 'Сумма'], true); }
    const y = doc.y;
    let x = 42;
    cells.forEach((cell, i) => {
      doc.rect(x, y, widths[i], height).fillAndStroke(header ? '#e8edf2' : '#ffffff', '#ccd3da');
      doc.fillColor('#16202b').text(clean(cell), x + 5, y + 6, { width: widths[i] - 10, align: i >= 2 ? 'right' : 'left' });
      x += widths[i];
    });
    doc.y = y + height;
  };
  row(['№', 'Товар', 'Кол-во', 'Цена', 'Сумма'], true);
  data.items.forEach((item: any, i: number) => row([String(i + 1), item.name, String(item.quantity), invoiceMoney(item.unitPriceMinor), invoiceMoney(item.totalMinor)]));
  doc.y += 12;
  space(125);
  text(`Итого: ${invoiceMoney(data.amountMinor)}`, 14);
  text(`НДС: ${s.vatLabel}.`, 10);
  text('Назначение платежа', 11);
  text(data.paymentPurpose, 10);
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#687582').text(`${i + 1} / ${pages.count}`, 42, doc.page.height - 42, { width, align: 'right', lineBreak: false });
  }
  doc.end();
  return result;
}
