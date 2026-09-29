import type { InvoiceBuyer } from './types';

/** Explicit allowlist: financial fields never enter the checkout contract. */
export function serializeInvoiceBuyer(buyer: InvoiceBuyer): InvoiceBuyer {
  return {
    buyerType: buyer.buyerType,
    legalName: buyer.legalName.trim(),
    inn: buyer.inn.trim(),
    ...(buyer.buyerType === 'legal_entity' && buyer.kpp?.trim() ? { kpp: buyer.kpp.trim() } : {}),
    legalAddress: buyer.legalAddress.trim(),
    contactName: buyer.contactName.trim(),
    phone: buyer.phone.trim(),
    email: buyer.email.trim().toLowerCase(),
  };
}
