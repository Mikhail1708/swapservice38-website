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
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true,
    info: { Title: `Счёт на оплату №${data.invoiceNumber}`, Author: data.seller.legalName,
      CreationDate: data.issuedAt, ModDate: data.issuedAt } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.font(path.resolve(__dirname, '../../assets/fonts/NotoSans.ttf'));
  const left = 40;
  const width = doc.page.width - left * 2;
  const bottom = doc.page.height - 62;
  const clean = (value: unknown) => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const ensure = (height: number) => { if (doc.y + height > bottom) doc.addPage(); };
  const line = (y: number, color = '#bbbbbb') => doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).stroke(color);
  const section = (label: string) => {
    ensure(48);
    doc.y += 10;
    line(doc.y, '#333333');
    doc.fontSize(9).fillColor('#111111').text(label, left, doc.y + 7, { width, characterSpacing: 1 });
    doc.y += 7;
  };
  const field = (label: string, value: unknown) => {
    doc.fontSize(8);
    const text = clean(value);
    const height = Math.max(12, doc.heightOfString(text, { width: width - 133, lineGap: 1 }));
    ensure(height + 3);
    const y = doc.y;
    doc.fillColor('#555555').text(label, left, y, { width: 125, lineGap: 1 });
    doc.fillColor('#111111').text(text, left + 133, y, { width: width - 133, lineGap: 1 });
    doc.y = y + height + 3;
  };
  // Packaged with the backend, so both src and dist work without a frontend mount.
  doc.image(path.resolve(__dirname, '../../assets/brand/logo.png'), (doc.page.width - 66) / 2, 32, { width: 66 });
  doc.fontSize(16).fillColor('#111111').text(`СЧЁТ НА ОПЛАТУ № ${clean(data.invoiceNumber)}`, left, 107, { width, align: 'center' });
  doc.fontSize(9).text(`Заказ № ${clean(data.orderNumber)}`, left, doc.y + 3, { width, align: 'center' });
  doc.y += 12;
  field('Дата выставления', invoiceDate(data.issuedAt));
  field('Оплатить до', invoiceDate(data.dueAt));
  const s = data.seller;
  section('ПРОДАВЕЦ');
  field('Наименование', s.legalName);
  field('ИНН / ОГРНИП', `${s.inn} / ${s.ogrnip}`);
  field('Юридический адрес', s.legalAddress);
  section('БАНКОВСКИЕ РЕКВИЗИТЫ');
  field('Получатель', s.legalName);
  field('Расчётный счёт', s.settlementAccount);
  field('Банк', s.bankName);
  field('БИК / ИНН банка', `${s.bankBik} / ${s.bankInn}`);
  field('Корреспондентский счёт', s.bankCorrespondentAccount);
  field('Адрес банка', s.bankAddress);
  const b = data.buyer;
  section('ПОКУПАТЕЛЬ');
  field('Тип покупателя', b.buyerType === 'individual_entrepreneur' ? 'Индивидуальный предприниматель' : 'Юридическое лицо');
  field('Наименование / ФИО', b.legalName);
  field(b.kpp ? 'ИНН / КПП' : 'ИНН', b.kpp ? `${b.inn} / ${b.kpp}` : b.inn);
  field('Юридический адрес', b.legalAddress);
  field('Контактное лицо', b.contactName);
  field('Телефон / Email', `${b.phone} / ${b.email}`);
  section('ТОВАРЫ');
  const widths = [24, width - 24 - 85 - 40 - 78 - 78, 85, 40, 78, 78];
  const headings = ['№', 'Наименование', 'Артикул', 'Кол-во', 'Цена', 'Сумма'];
  // Wrap explicitly to allow even one exceptionally long item to span pages.
  const wrap = (value: string, cellWidth: number): string[] => {
    const lines: string[] = [];
    let current = '';
    for (const word of clean(value).split(/\s+/)) {
      if (current && doc.widthOfString(`${current} ${word}`) <= cellWidth) { current += ` ${word}`; continue; }
      if (current) lines.push(current);
      current = '';
      for (const char of word) {
        if (current && doc.widthOfString(current + char) > cellWidth) { lines.push(current); current = ''; }
        current += char;
      }
    }
    if (current || !lines.length) lines.push(current);
    return lines;
  };
  const drawCells = (cells: string[][], height: number, header = false) => {
    const y = doc.y;
    let x = left;
    if (header) doc.rect(left, y, width, height).fill('#eeeeee');
    cells.forEach((cell, i) => {
      doc.fillColor('#111111').text(cell.join('\n'), x + 4, y + 5,
        { width: widths[i] - 8, align: i >= 3 ? 'right' : 'left', lineGap: 0 });
      x += widths[i];
    });
    line(y + height);
    doc.y = y + height;
  };
  const header = () => { doc.fontSize(7.5); drawCells(headings.map(x => [x]), 23, true); };
  ensure(50);
  header();
  data.items.forEach((item: any, index: number) => {
    doc.fontSize(7.5);
    const cells = [String(index + 1), item.name, clean(item.sku).trim() || '-', String(item.quantity),
      invoiceMoney(item.unitPriceMinor), invoiceMoney(item.totalMinor)].map((x, i) => wrap(x, widths[i] - 8));
    const lineHeight = doc.currentLineHeight(true);
    let remaining = Math.max(...cells.map(x => x.length));
    // Prefer keeping ordinary rows together; only split a row larger than a fresh page.
    if (doc.y + remaining * lineHeight + 10 > bottom && remaining * lineHeight + 10 <= bottom - 63) {
      doc.addPage(); header();
    }
    while (remaining > 0) {
      const count = Math.min(remaining, Math.floor((bottom - doc.y - 10) / lineHeight));
      if (count < 1) { doc.addPage(); header(); continue; }
      drawCells(cells.map(cell => cell.splice(0, count)), count * lineHeight + 10);
      remaining -= count;
      if (remaining) { doc.addPage(); header(); }
    }
  });
  ensure(100);
  doc.y += 12;
  doc.fontSize(14).fillColor('#111111').text(`ИТОГО: ${invoiceMoney(data.amountMinor)}`, left, doc.y, { width, align: 'right' });
  doc.fontSize(9).text(`НДС: ${clean(s.vatLabel)}.`, left, doc.y + 3, { width, align: 'right' });
  section('НАЗНАЧЕНИЕ ПЛАТЕЖА');
  doc.fontSize(9).text(clean(data.paymentPurpose), left, doc.y, { width, lineGap: 2 });
  ensure(25);
  doc.fontSize(8).fillColor('#555555').text('При оплате укажите назначение платежа без изменений.', left, doc.y + 6, { width });
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const marginBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 42;
    line(y - 8);
    doc.fontSize(7).fillColor('#555555').text('SWAP SERVICE 38  |  swap38.ru', left, y, { width, lineBreak: false });
    doc.text(`${i + 1} / ${pages.count}`, left, y, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = marginBottom;
  }
  doc.end();
  return result;
}
