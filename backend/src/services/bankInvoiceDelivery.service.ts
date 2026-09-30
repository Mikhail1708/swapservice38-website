import { Prisma, PrismaClient } from '@prisma/client';
import axios from 'axios';
import { prisma } from '../config/prisma';
import { createInvoiceSellerSnapshot } from '../config/invoiceSeller';
import { calculateInvoiceDueAt, INVOICE_TIME_ZONE } from '../utils/invoiceBusinessDays';
import { getInternalApiKey } from '../utils/internalApiKey';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';
import { persistInvoiceIssuedEmail } from './invoiceEmail.service';
import { CRM_DELIVERY_MAX_ATTEMPTS, classifyCrmDeliveryError, crmDeliveryDelayMs, deliveryClaimWhere } from './crmDelivery.service';

export const BANK_INVOICE_INTAKE_TYPE = 'bank_invoice_intake_requested';
export const BANK_INVOICE_RELEASE_TYPE = 'bank_invoice_release_requested';
export const bankInvoiceIntakeKey = (id: string) => `bank-invoice-intake:${id}`;
export const bankInvoiceReleaseKey = (id: string) => `bank-invoice-release:${id}`;
type Writer = Prisma.TransactionClient | PrismaClient;
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const equal = (a: any, b: any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Caller holds the order workflow lock. The first payload remains immutable. */
export async function ensureBankInvoiceIntake(tx: Writer, order: any, invoice: any, now = new Date()) {
  if (invoice.documentStatus !== 'preparing' || invoice.paymentStatus !== 'unpaid'
    || order.paymentMethod !== 'bank_invoice') throw new Error('Invoice is not eligible for intake');
  const key = bankInvoiceIntakeKey(invoice.id);
  const year = new Intl.DateTimeFormat('en', { timeZone: INVOICE_TIME_ZONE, year: 'numeric' }).format(now);
  const request = {
    contractVersion: 1, requestId: key, externalOrderId: order.id, invoiceId: invoice.id,
    invoiceNumber: `BI-${year}-${invoice.id}`, issuedAt: now.toISOString(),
    dueAt: calculateInvoiceDueAt(now).toISOString(), amountMinor: invoice.amountMinor.toString(),
    currency: invoice.currency, paymentMethod: 'bank_invoice', paymentStatus: 'unpaid',
    buyerSnapshot: invoice.buyerSnapshot, itemsSnapshot: invoice.itemsSnapshot,
    delivery: { method: order.deliveryMethod, address: order.deliveryAddress || null,
      provider: order.deliveryProvider || null, contactMethod: order.contactMethod,
      comment: order.comment || null },
  };
  return tx.outboxEvent.upsert({ where: { deduplicationKey: key }, create: {
    aggregateId: order.id, type: BANK_INVOICE_INTAKE_TYPE, deduplicationKey: key,
    payload: { request, sellerSnapshot: { ...createInvoiceSellerSnapshot() } } as Prisma.InputJsonValue,
  }, update: {} });
}

export async function ensureBankInvoiceRelease(tx: Writer, order: any, invoice: any, reason: string) {
  const key = bankInvoiceReleaseKey(invoice.id);
  return tx.outboxEvent.upsert({ where: { deduplicationKey: key }, create: {
    aggregateId: order.id, type: BANK_INVOICE_RELEASE_TYPE, deduplicationKey: key,
    payload: { externalOrderId: order.id, invoiceId: invoice.id, requestId: key, reason },
  }, update: {} });
}

type Post = (url: string, body: any, config: any) => Promise<{ data: any }>;
export function createBankInvoiceDeliveryService(db: PrismaClient = prisma, post: Post = axios.post) {
  async function dispatch(eventId: string): Promise<boolean> {
    const located = await db.outboxEvent.findUnique({ where: { id: eventId } });
    if (!located || ![BANK_INVOICE_INTAKE_TYPE, BANK_INVOICE_RELEASE_TYPE].includes(located.type)) return false;
    const work = await db.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, located.aggregateId);
      const event = await tx.outboxEvent.findUnique({ where: { id: eventId } });
      if (!event || event.status !== 'pending' || event.processedAt || event.nextAttemptAt > new Date()) return null;
      if (event.attempts >= CRM_DELIVERY_MAX_ATTEMPTS) {
        await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lockedAt: null, lastError: 'CRM invoice delivery budget exhausted' } });
        return null;
      }
      const order = await tx.order.findUnique({ where: { id: event.aggregateId }, include: { invoice: true, paymentAttempts: true } });
      const payload = event.payload as any;
      const release = event.type === BANK_INVOICE_RELEASE_TYPE;
      const request = release ? payload : payload?.request;
      if (!order?.invoice || order.paymentMethod !== 'bank_invoice' || request?.externalOrderId !== order.id
        || request?.invoiceId !== order.invoice.id || request.requestId !== (release ? bankInvoiceReleaseKey : bankInvoiceIntakeKey)(order.invoice.id)
        || order.invoice.paymentStatus !== 'unpaid'
        || order.paymentAttempts.some(a => !['canceled', 'failed'].includes(a.status))) {
        await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lastError: 'Invoice identity or payment conflict' } });
        return null;
      }
      if (!release && (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled')) {
        await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
        await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'completed', processedAt: new Date(), lockedAt: null } });
        return null;
      }
      if (!release && (request.amountMinor !== order.invoice.amountMinor.toString() || request.currency !== order.invoice.currency
        || !equal(request.buyerSnapshot, order.invoice.buyerSnapshot) || !equal(request.itemsSnapshot, order.invoice.itemsSnapshot))) {
        await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'failed', lastError: 'Immutable invoice payload mismatch' } });
        return null;
      }
      const claim = { id: event.id, orderId: order.id, attempts: event.attempts + 1, lockedAt: new Date() };
      await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'processing', attempts: claim.attempts, lockedAt: claim.lockedAt, lastError: null } });
      return { claim, release, request, payload };
    });
    if (!work) return false;
    const { claim, release, request, payload } = work;
    try {
      const base = process.env.CRM_API_URL || 'http://localhost:5000';
      const url = `${base}/api/sale-documents/internal/v1/invoice-orders${release ? `/${encodeURIComponent(claim.orderId)}/release` : ''}`;
      const response = await post(url, release ? { invoiceId: request.invoiceId, requestId: request.requestId, reason: request.reason } : request,
        { timeout: 15_000, headers: { 'Content-Type': 'application/json', 'X-API-Key': getInternalApiKey() } });
      const result = response.data;
      if (result?.contractVersion !== 1 || result.externalOrderId !== claim.orderId || result.invoiceId !== request.invoiceId
        || result.paymentMethod !== 'bank_invoice' || result.paymentStatus !== 'unpaid'
        || !['held', 'released'].includes(result.allocationStatus)
        || (release && result.allocationStatus !== 'released')) throw new Error('Invalid CRM invoice response');
      if (!release && result.allocationStatus === 'held' && (result.invoiceNumber !== request.invoiceNumber || result.amountMinor !== request.amountMinor
        || result.currency !== request.currency || result.dueAt !== request.dueAt)) throw new Error('CRM invoice snapshot mismatch');
      if (result.allocationStatus === 'held' && (!Number.isSafeInteger(result.crmOrderId) || result.crmOrderId <= 0
        || typeof result.documentNumber !== 'string' || !result.documentNumber.trim())) throw new Error('CRM document identity missing');
      if (result.crmOrderId != null && (!Number.isSafeInteger(result.crmOrderId) || result.crmOrderId <= 0
        || typeof result.documentNumber !== 'string' || !result.documentNumber.trim())) throw new Error('Invalid CRM document identity');
      return await db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, claim.orderId);
        const owned = await tx.outboxEvent.findFirst({ where: deliveryClaimWhere(claim) });
        if (!owned) return false; // A stale HTTP response may never finalize another worker's lease.
        const order = await tx.order.findUnique({ where: { id: claim.orderId }, include: { invoice: true, paymentAttempts: true } });
        if (!order?.invoice || order.invoice.id !== request.invoiceId || order.invoice.paymentStatus !== 'unpaid'
          || order.paymentAttempts.some(a => !['canceled', 'failed'].includes(a.status))) throw new Error('Invoice payment state changed');
        if (order.crmOrderId && result.crmOrderId != null && order.crmOrderId !== String(result.crmOrderId)) throw new Error('CRM identity conflict');
        if (result.allocationStatus === 'released') {
          await tx.invoice.update({ where: { id: order.invoice.id }, data: { documentStatus: 'void' } });
          await tx.order.update({ where: { id: order.id }, data: {
            status: 'cancelled', cancellationState: 'accepted', cancellationResolvedAt: new Date(),
            cancellationDecisionReason: 'bank_invoice_allocation_released',
            ...(Number.isSafeInteger(result.statusVersion) && result.statusVersion >= 0
              ? { crmStatusVersion: Math.max(order.crmStatusVersion || 0, result.statusVersion) } : {}),
            ...(result.crmOrderId != null ? { crmOrderId: String(result.crmOrderId), orderNumber: result.documentNumber } : {}),
          } });
        } else if (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled') {
          await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
        } else {
          await tx.order.update({ where: { id: order.id }, data: { crmOrderId: String(result.crmOrderId), orderNumber: result.documentNumber } });
          if (!order.invoice.issuedAt) {
            if (order.invoice.documentStatus !== 'preparing' || !equal(order.invoice.itemsSnapshot, request.itemsSnapshot)
              || !equal(order.invoice.buyerSnapshot, request.buyerSnapshot) || order.invoice.amountMinor.toString() !== request.amountMinor) throw new Error('Invoice changed before finalize');
            const issuedInvoice = await tx.invoice.update({ where: { id: order.invoice.id }, data: {
              documentStatus: 'issued', invoiceNumber: request.invoiceNumber,
              issuedAt: new Date(request.issuedAt), dueAt: new Date(request.dueAt), sellerSnapshot: payload.sellerSnapshot,
              orderNumberSnapshot: result.documentNumber,
              paymentPurpose: `Оплата по счёту №${request.invoiceNumber} за товары по заказу №${result.documentNumber}. ${payload.sellerSnapshot.vatLabel}.`,
            } });
            await persistInvoiceIssuedEmail(tx, issuedInvoice);
          }
        }
        const completed = await tx.outboxEvent.updateMany({ where: deliveryClaimWhere(claim), data: { status: 'completed', processedAt: new Date(), lockedAt: null, lastError: null } });
        // Recovery may revoke a stale lease while this transaction finalizes.
        // Roll back the document/order writes unless this exact claim still owns it.
        if (completed.count !== 1) throw new Error('Invoice delivery lease was lost during finalization');
        return true;
      });
    } catch (error) {
      // CRM serializes release against payment confirmation. A definitive business
      // refusal resolves the request; transport failures must remain retryable.
      if (release && (error as any)?.response?.status === 409
        && (error as any)?.response?.data?.code === 'INVOICE_RELEASE_FORBIDDEN') {
        return db.$transaction(async tx => {
          await lockPaymentWorkflowOrder(tx, claim.orderId);
          const owned = await tx.outboxEvent.findFirst({ where: deliveryClaimWhere(claim) });
          if (!owned) return false;
          const order = await tx.order.findUnique({ where: { id: claim.orderId }, include: { invoice: true } });
          if (order?.cancellationState === 'requested') {
            await tx.order.update({ where: { id: order.id }, data: {
              cancellationState: 'rejected', cancellationResolvedAt: new Date(),
              cancellationDecisionReason: order.invoice?.paymentStatus === 'paid' ? 'bank_invoice_already_paid' : 'bank_invoice_release_forbidden',
            } });
          }
          const completed = await tx.outboxEvent.updateMany({ where: deliveryClaimWhere(claim), data: {
            status: 'completed', processedAt: new Date(), lockedAt: null, lastError: 'INVOICE_RELEASE_FORBIDDEN',
          } });
          if (completed.count !== 1) throw new Error('Invoice release lease lost');
          return false;
        });
      }
      const classification = classifyCrmDeliveryError(error);
      await db.outboxEvent.updateMany({ where: deliveryClaimWhere(claim), data: {
        status: !classification.transient || claim.attempts >= CRM_DELIVERY_MAX_ATTEMPTS ? 'failed' : 'pending',
        lockedAt: null, nextAttemptAt: new Date(Date.now() + crmDeliveryDelayMs(claim.attempts, classification.retryAfterMs)),
        lastError: classification.diagnostic,
      } });
      return false;
    }
  }

  let cursor: string | undefined;
  async function recover() {
    const rows = await db.invoice.findMany({ where: { documentStatus: 'preparing', paymentStatus: 'unpaid' },
      orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 100 });
    cursor = rows.length === 100 ? rows[rows.length - 1].id : undefined;
    for (const row of rows) await db.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, row.orderId);
      const order = await tx.order.findUnique({ where: { id: row.orderId }, include: { invoice: true } });
      if (!order?.invoice || order.invoice.documentStatus !== 'preparing' || order.paymentMethod !== 'bank_invoice') return;
      if (['requested', 'accepted'].includes(order.cancellationState) || order.status === 'cancelled') {
        await ensureBankInvoiceRelease(tx, order, order.invoice, order.cancellationReason || 'cancellation');
      } else await ensureBankInvoiceIntake(tx, order, order.invoice);
    });
  }

  async function replay(eventId: string) {
    const event = await db.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event || ![BANK_INVOICE_INTAKE_TYPE, BANK_INVOICE_RELEASE_TYPE].includes(event.type)) throw new Error('Invoice event not found');
    return db.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, event.aggregateId);
      return tx.outboxEvent.updateMany({ where: { id: eventId, status: 'failed', processedAt: null },
        data: { status: 'pending', attempts: 0, lockedAt: null, nextAttemptAt: new Date(), lastError: null } });
    });
  }
  return { dispatch, recover, replay };
}
export const bankInvoiceDeliveryService = createBankInvoiceDeliveryService();
