import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { requestInvoiceSchema } from '../schemas/invoice.schema';
import { lockPaymentWorkflowOrder } from './paymentWorkflowLock.service';
import { getOrderPaymentView } from './orderPaymentView.service';
import { ensureBankInvoiceIntake, bankInvoiceIntakeKey, BANK_INVOICE_INTAKE_TYPE } from './bankInvoiceDelivery.service';
import { matchesAuthoritativePayment } from './paymentValidation.service';

export class InvoiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message);
    this.name = 'InvoiceError';
  }
}

// Order still uses Float. Accept its ordinary binary rounding noise, but never
// round a genuinely fractional kopeck or cross Number's exact-integer boundary.
export function invoiceAmountMinor(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvoiceError('INVALID_ORDER_AMOUNT', 'Некорректная сумма заказа');
  }
  const scaled = value * 100;
  const minor = Math.round(scaled);
  const tolerance = Math.min(0.00001, Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4);
  if (!Number.isSafeInteger(minor) || Math.abs(scaled - minor) > tolerance) {
    throw new InvoiceError('INVALID_ORDER_AMOUNT', 'Сумма должна быть выражена в целых копейках');
  }
  return BigInt(minor);
}

export function buildInvoiceItemsSnapshot(items: unknown, total: number) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvoiceError('INVALID_ORDER_ITEMS', 'Заказ не содержит товаров');
  }
  let sum = 0n;
  const snapshot = items.map(item => {
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
      || !['string', 'number'].includes(typeof item.productId) || !String(item.productId).trim()
      || typeof item.name !== 'string' || !item.name.trim()) {
      throw new InvoiceError('INVALID_ORDER_ITEMS', 'Некорректные позиции заказа');
    }
    const price = invoiceAmountMinor(item.price);
    const line = price * BigInt(item.quantity);
    sum += line;
    return {
      productId: String(item.productId), name: item.name,
      sku: typeof item.sku === 'string' && item.sku.trim() ? item.sku.trim() : null,
      quantity: item.quantity, unitPriceMinor: price.toString(), totalMinor: line.toString(),
    };
  });
  const amountMinor = invoiceAmountMinor(total);
  if (amountMinor <= 0n || amountMinor !== sum) {
    throw new InvoiceError('ORDER_AMOUNT_MISMATCH', 'Итог заказа не совпадает с суммой позиций');
  }
  return { amountMinor, itemsSnapshot: snapshot };
}

/** Only for a freshly inserted, unpaid order in the same checkout transaction. */
export async function prepareCheckoutInvoice(tx: Prisma.TransactionClient, order: any, buyer: unknown) {
  const parsed = requestInvoiceSchema.safeParse({ buyer });
  if (!parsed.success) throw new InvoiceError('INVALID_INVOICE_BUYER', 'Некорректные реквизиты покупателя', 400);
  if (order.paymentMethod !== 'bank_invoice' || order.status !== 'pending' || order.paymentId || order.crmOrderId) {
    throw new InvoiceError('INVOICE_NOT_ALLOWED', 'Недопустимое состояние нового заказа');
  }
  const money = buildInvoiceItemsSnapshot(order.items, order.total);
  const invoice = await tx.invoice.create({ data: {
    orderId: order.id, amountMinor: money.amountMinor,
    itemsSnapshot: money.itemsSnapshot, buyerSnapshot: { ...parsed.data.buyer },
  } });
  await ensureBankInvoiceIntake(tx, order, invoice);
  return invoice;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// PostgreSQL jsonb does not preserve key order.
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equalSnapshot = (a: unknown, b: unknown) => sameJson(canonical(a), canonical(b));

type ProviderLookup = (paymentId: string) => Promise<any>;
const authoritativePayment: ProviderLookup = async paymentId => {
  const { getPaymentStatus } = await import('./payment.service');
  return getPaymentStatus(paymentId);
};

/** Internal service: no public route, PDF or paid mutation.
 * Durable delivery finalizes issuance after confirmed CRM allocation.
 * The dependency seam is server-owned, never populated from a request body.
 */
export function createInvoiceService(db: PrismaClient = prisma, lookup: ProviderLookup = authoritativePayment, clock: () => Date = () => new Date()) {
  async function canceledEvidence(orderId: string, userId?: string) {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { paymentAttempts: true } });
    if (!order || (userId !== undefined && order.userId !== userId)) {
      throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
    }
    const attempt = order.paymentAttempts[0];
    if (attempt?.status !== 'canceled' || !attempt.providerPaymentId || !attempt.reservationId) return null;
    // A local canceled flag alone is not proof. Re-fetch the exact provider payment.
    let payment: any;
    try { payment = await lookup(attempt.providerPaymentId); }
    catch { throw new InvoiceError('PAYMENT_RECONCILIATION_REQUIRED', 'Не удалось подтвердить отмену платежа'); }
    if (payment?.status !== 'canceled' || !matchesAuthoritativePayment(order, payment, attempt.providerPaymentId)) {
      throw new InvoiceError('PAYMENT_RECONCILIATION_REQUIRED', 'Необходима сверка онлайн-платежа');
    }
    return { id: attempt.id, paymentId: attempt.providerPaymentId, reservationId: attempt.reservationId,
      amountMinor: attempt.amountMinor, currency: attempt.currency };
  }

  async function released(tx: Prisma.TransactionClient, orderId: string, attempt: any, evidence: any) {
    if (!evidence || !attempt || evidence.id !== attempt.id || evidence.paymentId !== attempt.providerPaymentId
      || evidence.reservationId !== attempt.reservationId || attempt.status !== 'canceled'
      || evidence.amountMinor !== attempt.amountMinor || evidence.currency !== attempt.currency) return false;
    const event = await tx.outboxEvent.findUnique({
      where: { deduplicationKey: `crm-reservation-release:${attempt.reservationId}` },
    });
    const payload = event?.payload as any;
    return event?.type === 'crm_reservation_release_requested' && event.aggregateId === orderId
      && event.status === 'completed' && event.processedAt !== null
      && payload?.orderId === orderId && payload?.reservationId === attempt.reservationId;
  }

  async function prepare(orderId: string, userId: string, input: unknown) {
    if (!userId) throw new InvoiceError('UNAUTHORIZED', 'Необходима авторизация', 401);
    const parsed = requestInvoiceSchema.safeParse(input);
    if (!parsed.success) throw new InvoiceError('INVALID_INVOICE_BUYER', 'Некорректные реквизиты или поля запроса', 400);
    // Fast idempotent read avoids external calls for a previously prepared invoice.
    const owned = await db.order.findFirst({ where: { id: orderId, userId }, include: { invoice: true } });
    if (!owned) throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
    if (owned.invoice) {
      if (!equalSnapshot(owned.invoice.buyerSnapshot, parsed.data.buyer)) {
        throw new InvoiceError('INVOICE_ALREADY_EXISTS', 'Для заказа уже сохранены другие реквизиты счёта');
      }
      return db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, orderId);
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
        if (!order?.invoice) throw new InvoiceError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
        if (order.invoice.documentStatus === 'preparing' && !['requested', 'accepted'].includes(order.cancellationState) && order.status !== 'cancelled') {
          await ensureBankInvoiceIntake(tx, order, order.invoice, clock());
        }
        return order.invoice;
      });
    }
    const evidence = await canceledEvidence(orderId, userId);
    return db.$transaction(async tx => {
      await lockPaymentWorkflowOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true, paymentAttempts: true } });
      if (!order || order.userId !== userId) throw new InvoiceError('ORDER_NOT_FOUND', 'Заказ не найден', 404);
      if (order.invoice) {
        if (!equalSnapshot(order.invoice.buyerSnapshot, parsed.data.buyer)) {
          throw new InvoiceError('INVOICE_ALREADY_EXISTS', 'Для заказа уже сохранены другие реквизиты счёта');
        }
        return order.invoice;
      }
      const attempt = order.paymentAttempts[0] || null;
      const reservationReleased = await released(tx, orderId, attempt, evidence);
      const view = getOrderPaymentView(order, attempt, null, { reservationReleased });
      if (!view.canRequestInvoice) {
        throw new InvoiceError('INVOICE_NOT_ALLOWED', 'Счёт недоступен: требуется проверка состояния заказа и оплаты');
      }
      const money = buildInvoiceItemsSnapshot(order.items, order.total);
      const invoice = await tx.invoice.create({ data: {
        orderId, amountMinor: money.amountMinor,
        itemsSnapshot: money.itemsSnapshot, buyerSnapshot: { ...parsed.data.buyer },
      } });
      // Reserve the payment branch before returning; the provider-start lock sees it.
      await tx.order.update({ where: { id: orderId }, data: { paymentMethod: 'bank_invoice' } });
      await ensureBankInvoiceIntake(tx, { ...order, paymentMethod: 'bank_invoice' }, invoice, clock());
      return invoice;
    }, { maxWait: 5_000, timeout: 10_000 });
  }

  // Issuance belongs to the fenced delivery transaction, after confirmed CRM allocation.
  async function issue(orderId: string, _now = new Date()) {
    const invoice = await db.invoice.findUnique({ where: { orderId } });
    if (!invoice) throw new InvoiceError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    const event = await db.outboxEvent.findUnique({ where: { deduplicationKey: bankInvoiceIntakeKey(invoice.id) } });
    if (!invoice.issuedAt || event?.type !== BANK_INVOICE_INTAKE_TYPE || event.status !== 'completed' || !event.processedAt) {
      throw new InvoiceError('CRM_INVOICE_INTAKE_REQUIRED', 'Confirmed CRM invoice delivery is required');
    }
    return invoice;
  }

  return { prepare, issue };
}

export const invoiceService = createInvoiceService();

// Explicit DTO boundary for future HTTP/outbox use: native bigint is not JSON.
export const invoiceDto = <T extends { amountMinor: bigint }>(invoice: T) => ({
  ...invoice, amountMinor: invoice.amountMinor.toString(),
});

export const publicInvoice = (invoice: any) => invoice ? invoiceDto({
  id: invoice.id, orderId: invoice.orderId, invoiceNumber: invoice.invoiceNumber,
  documentStatus: invoice.documentStatus, paymentStatus: invoice.paymentStatus,
  amountMinor: invoice.amountMinor, currency: invoice.currency,
  issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, paidAt: invoice.paidAt,
  buyerSnapshot: invoice.buyerSnapshot, orderNumberSnapshot: invoice.orderNumberSnapshot,
  paymentPurpose: invoice.paymentPurpose, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt,
}) : null;

export const orderWithPaymentView = (order: any, reservationReleased = false) => {
  const payment = getOrderPaymentView(order, order.paymentAttempts?.[0] || null, order.invoice || null, { reservationReleased });
  return { ...order, ...payment, payment, invoice: publicInvoice(order.invoice) };
};

/** Display eligibility only: prepare() still re-verifies the provider under its workflow. */
export async function invoiceReservationReleased(order: any, db: PrismaClient = prisma): Promise<boolean> {
  const attempt = order?.paymentAttempts?.[0];
  if (order.invoice || !attempt?.reservationId || attempt.status !== 'canceled') return false;
  const event = await db.outboxEvent.findUnique({
    where: { deduplicationKey: `crm-reservation-release:${attempt.reservationId}` },
  });
  const payload = event?.payload as any;
  return event?.type === 'crm_reservation_release_requested' && event.aggregateId === order.id
    && event.status === 'completed' && event.processedAt != null
    && payload?.orderId === order.id && payload?.reservationId === attempt.reservationId;
}

export async function loadOrderPaymentView(order: any) {
  return orderWithPaymentView(order, await invoiceReservationReleased(order));
}
