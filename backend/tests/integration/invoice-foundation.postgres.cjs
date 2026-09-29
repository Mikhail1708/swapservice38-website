// Explicit opt-in integration suite. Provision/migrate a disposable local DB first:
// INVOICE_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/invoice_foundation_test
// node --test tests/integration/invoice-foundation.postgres.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const databaseUrl = process.env.INVOICE_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('INVOICE_TEST_DATABASE_URL must name the isolated local invoice_foundation_test database');
const target = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(target.protocol)
  || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  || decodeURIComponent(target.pathname) !== '/invoice_foundation_test'
  || [...target.searchParams.keys()].some(key => !['schema', 'connection_limit', 'pool_timeout'].includes(key))) {
  throw new Error('Refusing database: only loopback invoice_foundation_test with standard pool/schema options is allowed');
}
// Ensure even the module singleton can only refer to this validated disposable DB.
process.env.DATABASE_URL = databaseUrl;
process.env.INTERNAL_API_KEY = 'invoice-foundation-isolated-test-key';
process.env.CRM_API_URL = 'http://invoice-foundation.invalid';
require('ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../../tsconfig.json') });
const { PrismaClient } = require('@prisma/client');
const { createInvoiceService, invoiceDto } = require('../../src/services/invoice.service');
const { createBankInvoiceDeliveryService, bankInvoiceIntakeKey } = require('../../src/services/bankInvoiceDelivery.service');
const { createInvoiceSellerSnapshot } = require('../../src/config/invoiceSeller');
const { prisma: singleton } = require('../../src/config/prisma');

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = `invoice-test-${randomUUID()}`;
const buyer = {
  buyerType: 'individual_entrepreneur', legalName: 'ИП Тестовый Покупатель', inn: '381011379046',
  legalAddress: 'г. Иркутск, ул. Тестовая, д. 1', contactName: 'Тестовый Покупатель',
  phone: '+79991234567', email: 'invoice-buyer@example.test',
};
const input = () => ({ buyer: { ...buyer } });
const errorCode = code => error => error?.code === code;
const plannedIssueAt = new Date('2026-09-25T02:30:00.000Z');
const service = createInvoiceService(db, async () => { throw new Error('Unexpected provider lookup'); }, () => plannedIssueAt);
let owner;
let sequence = 0;
async function order(overrides = {}) {
  return db.order.create({ data: {
    id: `${prefix}-order-${++sequence}`, userId: owner.id, deliveryMethod: 'pickup',
    items: [{ productId: '1', name: 'Двигатель', sku: 'SKU-1', quantity: 2, price: 123.45 }],
    total: 246.90, ...overrides,
  } });
}
async function deliver(record) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { orderId: record.id } });
  const event = await db.outboxEvent.findUniqueOrThrow({ where: { deduplicationKey: bankInvoiceIntakeKey(invoice.id) } });
  // Only the HTTP seam is replaced: claim, validation, finalization and issuance
  // execute the production delivery service against real PostgreSQL.
  const delivery = createBankInvoiceDeliveryService(db, async (url, request, config) => {
    assert.equal(url, 'http://invoice-foundation.invalid/api/sale-documents/internal/v1/invoice-orders');
    assert.equal(config.headers['X-API-Key'], process.env.INTERNAL_API_KEY);
    assert.equal(request.externalOrderId, record.id);
    assert.equal(request.invoiceId, invoice.id);
    return { data: {
      contractVersion: 1, externalOrderId: record.id, invoiceId: invoice.id,
      invoiceNumber: request.invoiceNumber, crmOrderId: sequence, documentNumber: `${record.id}-number`,
      amountMinor: request.amountMinor, currency: request.currency,
      paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', allocationStatus: 'held',
      dueAt: request.dueAt, orderStatus: 'new', statusVersion: 1,
    } };
  });
  assert.equal(await delivery.dispatch(event.id), true);
  const completed = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.processedAt);
  return db.order.findUniqueOrThrow({ where: { id: record.id } });
}
async function issuedFixture() {
  const record = await order();
  await service.prepare(record.id, owner.id, input());
  await deliver(record);
  return service.issue(record.id);
}

test('invoice foundation against isolated PostgreSQL', { timeout: 120_000 }, async t => {
  try {
    await db.$connect();
    owner = await db.user.create({ data: { id: `${prefix}-user`, email: `${prefix}@example.test` } });

    await t.test('legacy Order defaults and preparation preserve authoritative money', async () => {
      const record = await order();
      assert.equal(record.paymentMethod, 'online');
      const prepared = await service.prepare(record.id, owner.id, input());
      assert.equal(prepared.documentStatus, 'preparing');
      assert.equal(prepared.paymentStatus, 'unpaid');
      assert.equal(prepared.amountMinor, 24690n);
      assert.equal(prepared.invoiceNumber, null);
      assert.equal(prepared.issuedAt, null);
      assert.equal(prepared.dueAt, null);
      assert.equal(prepared.sellerSnapshot, null);
      assert.deepEqual(prepared.itemsSnapshot, [{
        productId: '1', name: 'Двигатель', sku: 'SKU-1', quantity: 2,
        unitPriceMinor: '12345', totalMinor: '24690',
      }]);
      assert.deepEqual(prepared.buyerSnapshot, buyer);
      assert.equal((await db.order.findUnique({ where: { id: record.id } })).paymentMethod, 'bank_invoice');
      assert.equal(await db.paymentAttempt.count({ where: { orderId: record.id } }), 0);
      assert.equal(invoiceDto(prepared).amountMinor, '24690');
      assert.doesNotThrow(() => JSON.stringify(invoiceDto(prepared)));
    });

    await t.test('sequential and concurrent retries create exactly one invoice', async () => {
      const record = await order();
      const results = await Promise.all(Array.from({ length: 6 }, () => service.prepare(record.id, owner.id, input())));
      assert.equal(new Set(results.map(result => result.id)).size, 1);
      assert.equal((await service.prepare(record.id, owner.id, input())).id, results[0].id);
      assert.equal(await db.invoice.count({ where: { orderId: record.id } }), 1);
      await assert.rejects(service.prepare(record.id, owner.id, { buyer: { ...buyer, legalName: 'Другое наименование' } }), errorCode('INVOICE_ALREADY_EXISTS'));
    });

    await t.test('ownership and strict public input prevent mass assignment', async () => {
      const record = await order();
      await assert.rejects(service.prepare(record.id, `${prefix}-other-user`, input()), errorCode('ORDER_NOT_FOUND'));
      await assert.rejects(service.prepare(record.id, '', input()), errorCode('UNAUTHORIZED'));
      for (const [key, value] of Object.entries({
        amountMinor: '1', total: 0.01, sellerSnapshot: { legalName: 'Forged' }, paymentStatus: 'paid',
        paymentMethod: 'online', invoiceNumber: 'FORGED', issuedAt: new Date().toISOString(),
        reservationReleased: true, canPayOnline: true, canRequestInvoice: true,
      })) {
        await assert.rejects(service.prepare(record.id, owner.id, { ...input(), [key]: value }), errorCode('INVALID_INVOICE_BUYER'));
      }
      await assert.rejects(service.prepare(record.id, owner.id, { buyer: { ...buyer, amountMinor: 1 } }), errorCode('INVALID_INVOICE_BUYER'));
      await assert.rejects(service.prepare(record.id, owner.id, { buyer: { ...buyer, inn: '123456789012' } }), errorCode('INVALID_INVOICE_BUYER'));
      assert.equal(await db.invoice.count({ where: { orderId: record.id } }), 0);
      assert.equal((await db.order.findUnique({ where: { id: record.id } })).paymentMethod, 'online');
    });

    await t.test('invoice waits for the SAME order lock and rejects a concurrently admitted provider start', async () => {
      const { lockPaymentWorkflowOrder } = require('../../src/services/paymentWorkflowLock.service');
      const record = await order();
      let signalLocked, releaseLock;
      const locked = new Promise(resolve => { signalLocked = resolve; });
      const gate = new Promise(resolve => { releaseLock = resolve; });
      const providerAdmission = db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, record.id);
        signalLocked();
        await gate;
        await tx.paymentAttempt.create({ data: {
          orderId: record.id, provider: 'yookassa', idempotencyKey: `${record.id}-concurrent`,
          amountMinor: 24690, status: 'initiating', providerRequestStartedAt: new Date(),
        } });
      });
      await locked;
      const preparation = assert.rejects(service.prepare(record.id, owner.id, input()), errorCode('INVOICE_NOT_ALLOWED'));
      releaseLock();
      await Promise.all([providerAdmission, preparation]);
      assert.equal(await db.invoice.count({ where: { orderId: record.id } }), 0);
    });

    await t.test('provider admission after invoice preparation sees the bank branch under the same lock', async () => {
      const { lockPaymentWorkflowOrder } = require('../../src/services/paymentWorkflowLock.service');
      const { isOnlinePaymentBlocked } = require('../../src/services/orderPaymentView.service');
      const record = await order();
      await service.prepare(record.id, owner.id, input());
      await db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, record.id);
        const current = await tx.order.findUnique({ where: { id: record.id }, include: { invoice: true } });
        assert.equal(isOnlinePaymentBlocked(current, current.invoice), true);
      });
      assert.equal(await db.paymentAttempt.count({ where: { orderId: record.id } }), 0);
    });

    await t.test('issue requires CRM intake, freezes seller and Friday-to-Wednesday dates', async () => {
      const record = await order();
      const prepared = await service.prepare(record.id, owner.id, input());
      await assert.rejects(service.issue(record.id), errorCode('CRM_INVOICE_INTAKE_REQUIRED'));
      await db.order.update({ where: { id: record.id }, data: { crmOrderId: String(sequence), orderNumber: `${record.id}-number` } });
      await assert.rejects(service.issue(record.id), errorCode('CRM_INVOICE_INTAKE_REQUIRED'));
      const crm = await deliver(record);
      const now = plannedIssueAt;
      const issued = await service.issue(record.id);
      assert.equal(issued.id, prepared.id);
      assert.equal(issued.documentStatus, 'issued');
      assert.match(issued.invoiceNumber, /^BI-2026-/);
      assert.equal(issued.issuedAt.toISOString(), now.toISOString());
      assert.equal(issued.dueAt.toISOString(), '2026-09-30T02:30:00.000Z');
      assert.equal(issued.orderNumberSnapshot, crm.orderNumber);
      assert.deepEqual(issued.sellerSnapshot, createInvoiceSellerSnapshot());
      assert.deepEqual(issued.buyerSnapshot, buyer);
      assert.equal(issued.paymentPurpose, `Оплата по счёту №${issued.invoiceNumber} за товары по заказу №${crm.orderNumber}. Без НДС.`);
      await db.order.update({ where: { id: record.id }, data: {
        total: 300, items: [{ productId: '1', name: 'Изменённый товар', quantity: 1, price: 300 }],
      } });
      const repeated = await service.issue(record.id, new Date('2026-10-01T00:00:00.000Z'));
      assert.deepEqual(repeated, issued);
      assert.equal((await service.prepare(record.id, owner.id, input())).id, issued.id);
    });

    await t.test('preparation rejects inconsistent prices and delivery retains the prepared quote', async () => {
      const wrongTotal = await order({ total: 1 });
      await assert.rejects(service.prepare(wrongTotal.id, owner.id, input()), errorCode('ORDER_AMOUNT_MISMATCH'));
      assert.equal(await db.invoice.count({ where: { orderId: wrongTotal.id } }), 0);
      assert.equal((await db.order.findUnique({ where: { id: wrongTotal.id } })).paymentMethod, 'online');
      const record = await order();
      const prepared = await service.prepare(record.id, owner.id, input());
      await db.order.update({ where: { id: record.id }, data: {
        total: 100, items: [{ productId: '1', name: 'Другой товар', quantity: 1, price: 100 }],
      } });
      await assert.rejects(service.issue(record.id), errorCode('CRM_INVOICE_INTAKE_REQUIRED'));
      await deliver(record);
      const issued = await service.issue(record.id);
      assert.equal(issued.documentStatus, 'issued');
      assert.equal(issued.amountMinor, prepared.amountMinor);
      assert.deepEqual(issued.itemsSnapshot, prepared.itemsSnapshot);
    });

    await t.test('database enforces unique order and invoice number', async () => {
      const first = await issuedFixture();
      const secondOrder = await order();
      const duplicate = {
        orderId: first.orderId, amountMinor: 100n, buyerSnapshot: buyer,
        itemsSnapshot: [{ name: 'Test', quantity: 1, unitPriceMinor: '100', totalMinor: '100' }],
      };
      await assert.rejects(db.invoice.create({ data: duplicate }), errorCode('P2002'));
      const { id, createdAt, updatedAt, ...issuedData } = first;
      await assert.rejects(db.invoice.create({ data: { ...issuedData, orderId: secondOrder.id } }), errorCode('P2002'));
      // PostgreSQL 18 reports RESTRICT as SQLSTATE 23001; Prisma 5 may wrap it
      // as UnknownRequestError instead of P2003. Assert the actual FK barrier.
      await assert.rejects(db.order.delete({ where: { id: first.orderId } }), /Invoice_orderId_fkey/);
      const { noStartedPaymentWhere } = require('../../src/utils/paymentSafety');
      assert.equal((await db.order.deleteMany({ where: { id: first.orderId, ...noStartedPaymentWhere } })).count, 0);
    });

    await t.test('database rejects incomplete issuance, inconsistent payment and invalid money', async () => {
      const record = await order();
      const prepared = await service.prepare(record.id, owner.id, input());
      for (const data of [
        { documentStatus: 'issued' }, { issuedAt: new Date() }, { invoiceNumber: 'INCOMPLETE' },
        { paymentStatus: 'paid' }, { amountMinor: 0n }, { amountMinor: -1n }, { currency: 'USD' },
        { documentStatus: 'invalid' }, { snapshotVersion: 0 }, { itemsSnapshot: [] },
      ]) {
        await assert.rejects(db.invoice.update({ where: { id: prepared.id }, data }), /constraint|23514/i);
      }
      assert.equal((await db.invoice.findUnique({ where: { id: prepared.id } })).documentStatus, 'preparing');
    });

    await t.test('database trigger protects all issued financial snapshots and deletion', async () => {
      const issued = await issuedFixture();
      for (const data of [
        { amountMinor: 1n }, { sellerSnapshot: { changed: true } }, { buyerSnapshot: { ...buyer, legalName: 'Changed' } },
        { itemsSnapshot: [{ changed: true }] }, { invoiceNumber: `${issued.invoiceNumber}-changed` },
        { orderNumberSnapshot: 'changed' }, { paymentPurpose: 'changed' }, { snapshotVersion: 2 },
        { dueAt: new Date('2026-10-01T02:30:00.000Z') },
        { issuedAt: null, documentStatus: 'preparing', invoiceNumber: null, dueAt: null,
          sellerSnapshot: require('@prisma/client').Prisma.DbNull, orderNumberSnapshot: null, paymentPurpose: null },
      ]) {
        await assert.rejects(db.invoice.update({ where: { id: issued.id }, data }), /immutable/i);
      }
      await assert.rejects(db.invoice.delete({ where: { id: issued.id } }), /cannot be deleted/i);
      const paid = await db.invoice.update({ where: { id: issued.id }, data: { paymentStatus: 'paid', paidAt: new Date() } });
      assert.equal(paid.paymentStatus, 'paid');
      assert.deepEqual(paid.itemsSnapshot, issued.itemsSnapshot);
      assert.deepEqual(paid.sellerSnapshot, issued.sellerSnapshot);
    });

    await t.test('real attempt records block succeeded/pending/unknown and preserve attempts', async () => {
      for (const status of ['succeeded', 'pending', 'unknown', 'initiating', 'failed']) {
        const record = await order();
        const attempt = await db.paymentAttempt.create({ data: {
          orderId: record.id, provider: 'yookassa', idempotencyKey: `${record.id}-key`, amountMinor: 24690, status,
        } });
        await assert.rejects(service.prepare(record.id, owner.id, input()), errorCode('INVOICE_NOT_ALLOWED'));
        assert.equal((await db.paymentAttempt.findUnique({ where: { orderId: record.id } })).id, attempt.id);
        assert.equal(await db.invoice.count({ where: { orderId: record.id } }), 0);
      }
    });

    await t.test('canceled payment requires provider proof AND completed exact reservation release', async () => {
      const record = await order();
      const paymentId = `${record.id}-payment`;
      const reservationId = `${record.id}-reservation`;
      await db.order.update({ where: { id: record.id }, data: { paymentId } });
      const attempt = await db.paymentAttempt.create({ data: {
        orderId: record.id, provider: 'yookassa', idempotencyKey: `${record.id}-key`,
        amountMinor: 24690, status: 'canceled', providerPaymentId: paymentId, reservationId, lastCheckedAt: new Date(),
      } });
      let providerStatus = 'pending';
      let lookups = 0;
      const canceledService = createInvoiceService(db, async id => {
        lookups += 1;
        assert.equal(id, paymentId);
        return { id, status: providerStatus, amount: { value: '246.90', currency: 'RUB' }, metadata: { orderId: record.id, reservationId } };
      });
      await assert.rejects(canceledService.prepare(record.id, owner.id, input()), errorCode('PAYMENT_RECONCILIATION_REQUIRED'));
      providerStatus = 'canceled';
      await assert.rejects(canceledService.prepare(record.id, owner.id, input()), errorCode('INVOICE_NOT_ALLOWED'));
      const release = await db.outboxEvent.create({ data: {
        aggregateId: record.id, type: 'crm_reservation_release_requested',
        deduplicationKey: `crm-reservation-release:${reservationId}`, payload: { orderId: record.id, reservationId },
      } });
      await assert.rejects(canceledService.prepare(record.id, owner.id, input()), errorCode('INVOICE_NOT_ALLOWED'));
      await db.outboxEvent.update({ where: { id: release.id }, data: { status: 'completed', processedAt: new Date() } });
      const invoice = await canceledService.prepare(record.id, owner.id, input());
      assert.equal(invoice.orderId, record.id);
      assert.equal((await db.paymentAttempt.findUnique({ where: { orderId: record.id } })).id, attempt.id);
      const priorLookups = lookups;
      assert.equal((await canceledService.prepare(record.id, owner.id, input())).id, invoice.id);
      assert.equal(lookups, priorLookups);
    });
  } finally {
    // Issued invoices intentionally cannot be deleted. Every fixture has its own
    // run prefix; teardown never truncates tables or disables safety triggers.
    await Promise.all([db.$disconnect(), singleton.$disconnect()]);
  }
});
