/** Sole source of seller details for new invoice snapshots. */
export interface InvoiceSellerSnapshot {
  readonly configVersion: number;
  readonly legalName: string;
  readonly inn: string;
  readonly ogrnip: string;
  readonly legalAddress: string;
  readonly settlementAccount: string;
  readonly bankName: string;
  readonly bankBik: string;
  readonly bankInn: string;
  readonly bankCorrespondentAccount: string;
  readonly bankAddress: string;
  readonly vatMode: 'without_vat';
  readonly vatLabel: 'Без НДС';
}

export const invoiceSeller: InvoiceSellerSnapshot = Object.freeze({
  configVersion: 1,
  legalName: 'ИП БАТВЕНКО НИКОЛАЙ СЕРГЕЕВИЧ',
  inn: '381011379046',
  ogrnip: '315385000059546',
  legalAddress: '664020, Россия, Иркутская обл., г. Иркутск, ул. Зои Космодемьянской, д. 38',
  settlementAccount: '40802810900000298096',
  bankName: 'АО «ТБанк»',
  bankBik: '044525974',
  bankInn: '7710140679',
  bankCorrespondentAccount: '30101810145250000974',
  bankAddress: '127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26',
  vatMode: 'without_vat',
  vatLabel: 'Без НДС',
});

/** All fields are scalar, so a detached frozen copy is deeply immutable. */
export function createInvoiceSellerSnapshot(): InvoiceSellerSnapshot {
  return Object.freeze({ ...invoiceSeller });
}
