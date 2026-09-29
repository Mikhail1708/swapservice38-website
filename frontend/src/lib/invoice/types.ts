export type InvoiceBuyerType = 'legal_entity' | 'individual_entrepreneur';
export type InvoiceBuyer = {
  buyerType: InvoiceBuyerType;
  legalName: string;
  inn: string;
  kpp?: string;
  legalAddress: string;
  contactName: string;
  phone: string;
  email: string;
};
export type OrderPaymentView = {
  paymentMethod: 'online' | 'bank_invoice';
  paymentStatus: 'unpaid' | 'pending' | 'unknown' | 'paid' | 'refunded';
  canPayOnline: boolean;
  canRequestInvoice: boolean;
  canDownloadInvoice: boolean;
  invoiceBlockedReason?: string;
};
export type InvoiceView = {
  id: string;
  orderId: string;
  invoiceNumber?: string | null;
  documentStatus: 'preparing' | 'issued' | 'void' | string;
  paymentStatus: string;
  amountMinor: string;
  currency: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  buyerSnapshot?: InvoiceBuyer;
  orderNumberSnapshot?: string | null;
  paymentPurpose?: string | null;
};
