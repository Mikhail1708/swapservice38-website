// Cross-database integration: real SITE transactions + real CRM intake/release.
// Only the HTTP transport is replaced to inject lost responses and process crashes.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function isolatedUrl(key, database) {
  const value = process.env[key];
  assert.ok(value, `${key} is required`);
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.equal(decodeURIComponent(url.pathname), `/${database}`);
  for (const key of url.searchParams.keys()) assert.ok(['schema', 'connection_limit', 'pool_timeout'].includes(key));
  assert.ok(!url.searchParams.has('schema') || url.searchParams.get('schema') === 'public');
  return value;
}
const siteUrl = isolatedUrl('INVOICE_TEST_DATABASE_URL', 'invoice_foundation_test');
const crmUrl = isolatedUrl('INVOICE_CRM_TEST_DATABASE_URL', 'invoice_crm_test');
process.env.DATABASE_URL = siteUrl;
process.env.INTERNAL_API_KEY = 'isolated-invoice-test-key';
process.env.CRM_API_URL = 'http://invoice-crm.invalid';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_APP_URL = 'https://invoice-test.invalid';
process.env.WEBHOOK_SECRET = 'cross-stage3-test-secret';
require('ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../../tsconfig.json') });
// Recovery is exercised directly; the unrelated legacy Bull transport must never connect.
const legacyQueuePath = require.resolve('../../src/queues/crm.queue');
require.cache[legacyQueuePath] = { id: legacyQueuePath, filename: legacyQueuePath, loaded: true,
  exports: { addOrderToCRMQueue: async () => { throw new Error('Unexpected legacy delivery'); } } };
const onlinePaymentPath = require.resolve('../../src/services/payment.service');
require.cache[onlinePaymentPath] = { id: onlinePaymentPath, filename: onlinePaymentPath, loaded: true,
  exports: new Proxy({}, { get: () => () => { throw new Error('Unexpected online provider operation'); } }) };
const crmRoot = path.resolve(__dirname, '../../../../crm-project/backend');
const { PrismaClient } = require('@prisma/client');
const { PrismaClient: CrmPrismaClient } = require(path.join(crmRoot, 'node_modules/@prisma/client'));
const { createInvoiceService } = require('../../src/services/invoice.service');
const { createBankInvoiceDeliveryService, BANK_INVOICE_INTAKE_TYPE, BANK_INVOICE_RELEASE_TYPE } = require('../../src/services/bankInvoiceDelivery.service');
const { requestOrderCancellation } = require('../../src/services/orderCancellation.service');
const emailServicePath = require.resolve('../../src/services/email.service');
require.cache[emailServicePath] = { id: emailServicePath, filename: emailServicePath, loaded: true,
  exports: { sendOrderStatusUpdateToCustomer: async () => undefined } };
const { handleOrderStatusWebhook } = require('../../src/controllers/webhook.controller');
const { prisma: singleton } = require('../../src/config/prisma');
const { intakeBankInvoice, releaseBankInvoice } = require(path.join(crmRoot, 'src/services/invoiceIntake.service'));
const { confirmBankInvoicePayment } = require(path.join(crmRoot, 'src/services/invoiceConfirmation.service'));
const site = new PrismaClient({ datasources: { db: { url: siteUrl } } });
const crm = new CrmPrismaClient({ datasources: { db: { url: crmUrl } } });
const prefix = `delivery-${randomUUID()}`;
let user, sequence = 0;
const buyer = { buyerType: 'individual_entrepreneur', legalName: 'ИП Тестовый', inn: '381011379046',
  legalAddress: 'г. Иркутск, ул. Тестовая, д. 1', contactName: 'Тестовый Покупатель',
  phone: '+79991234567', email: 'buyer@example.test' };
const invoices = createInvoiceService(site, async () => { throw new Error('Provider must not be called'); });

async function fixture(stock = 5) {
  const id = `${prefix}-${++sequence}`;
  const product = await crm.product.create({ data: { name: id, article: id, cost_price: 40, retail_price: 120, stock } });
  // Snapshot price intentionally differs from today's CRM price: accepted Order is the quote.
  const order = await site.order.create({ data: { id, userId: user.id, deliveryMethod: 'pickup',
    customerEmail: buyer.email, customerPhone: buyer.phone, total: 100,
    items: [{ productId: String(product.id), name: product.name, sku: product.article, price: 100, quantity: 1 }] } });
  const invoice = await invoices.prepare(order.id, user.id, { buyer });
  const event = await site.outboxEvent.findFirst({ where: { aggregateId: order.id, type: BANK_INVOICE_INTAKE_TYPE } });
  assert.ok(event, 'preparation must atomically persist CRM delivery intent');
  return { order, product, invoice, event };
}
async function transport(url, body, config) {
  assert.equal(config.headers['X-API-Key'], process.env.INTERNAL_API_KEY);
  assert.ok(config.timeout > 0);
  try {
    const released = url.match(/\/invoice-orders\/([^/]+)\/release$/);
    const data = released
      ? await releaseBankInvoice(crm, decodeURIComponent(released[1]), body)
      : await intakeBankInvoice(crm, body);
    return { data };
  } catch (error) {
    if (error.status || error.statusCode) error.response = { status: error.status || error.statusCode, data: { code: error.code } };
    throw error;
  }
}
const delivery = createBankInvoiceDeliveryService(site, transport);
async function due(eventId) {
  await site.outboxEvent.update({ where: { id: eventId }, data: { nextAttemptAt: new Date(0) } });
}
async function countDocuments(orderId) { return crm.saleDocument.count({ where: { externalOrderId: orderId } }); }
function signWebhook(payload) {
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(key => [key, payload[key]])));
  return crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(canonical).digest('hex');
}
async function applySignedWebhook(payload) {
  let statusCode = 200;
  let body;
  const response = { status(code) { statusCode = code; return response; }, json(value) { body = value; return response; } };
  await handleOrderStatusWebhook({ body: payload, headers: { 'x-webhook-signature': signWebhook(payload) } }, response);
  return { statusCode, body };
}

if (process.env.INVOICE_CRASH_EVENT) {
  const crashing = createBankInvoiceDeliveryService(site, async (...args) => {
    if (process.env.INVOICE_CRASH_PHASE === 'before') process.exit(73);
    await transport(...args);
    process.exit(73);
  });
  crashing.dispatch(process.env.INVOICE_CRASH_EVENT).then(() => process.exit(74));
} else test('durable bank invoice delivery across two isolated PostgreSQL databases', { timeout: 120000 }, async t => {
  try {
    user = await site.user.create({ data: { id: `${prefix}-user`, email: `${prefix}@example.test` } });
    await t.test('prepare persists one immutable intent; confirmed CRM reply issues the same Invoice', async () => {
      const f = await fixture();
      assert.equal(f.invoice.documentStatus, 'preparing');
      const firstPayload = f.event.payload;
      await invoices.prepare(f.order.id, user.id, { buyer });
      assert.equal(await site.outboxEvent.count({ where: { aggregateId: f.order.id, type: BANK_INVOICE_INTAKE_TYPE } }), 1);
      assert.equal(await delivery.dispatch(f.event.id), true);
      assert.equal(await delivery.dispatch(f.event.id), false);
      const invoice = await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } });
      const localOrder = await site.order.findUniqueOrThrow({ where: { id: f.order.id } });
      const document = await crm.saleDocument.findUniqueOrThrow({ where: { externalOrderId: f.order.id } });
      assert.equal(invoice.documentStatus, 'issued');
      assert.equal(invoice.paymentStatus, 'unpaid');
      assert.equal(invoice.amountMinor, 10000n);
      assert.equal(invoice.orderNumberSnapshot, document.documentNumber);
      assert.equal(localOrder.crmOrderId, String(document.id));
      assert.equal(document.paymentMethod, 'bank_invoice');
      assert.equal(document.paymentStatus, 'unpaid');
      assert.equal(document.externalPaymentId, null);
      assert.equal(document.total, 100);
      assert.equal(await crm.sale.count({ where: { documentId: document.id } }), 0);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
      assert.deepEqual((await site.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } })).payload, firstPayload);
      assert.equal(await countDocuments(f.order.id), 1);
    });

    await t.test('manager confirmation commits held allocation and signed payment webhook is idempotent', async () => {
      const f = await fixture();
      await delivery.dispatch(f.event.id);
      const document = await crm.saleDocument.findUniqueOrThrow({ where: { externalOrderId: f.order.id } });
      const confirmed = await confirmBankInvoicePayment(crm, document.id, { id: 77, role: 'manager', name: 'Менеджер тестов' });
      assert.equal(confirmed.paymentStatus, 'paid');
      assert.equal(confirmed.idempotent, false);
      assert.equal((await crm.saleDocument.findUniqueOrThrow({ where: { id: document.id } })).paymentStatus, 'paid');
      assert.equal((await crm.invoiceAllocation.findUniqueOrThrow({ where: { externalOrderId: f.order.id } })).status, 'committed');
      assert.equal(await crm.sale.count({ where: { documentId: document.id } }), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
      const outbox = await crm.crmStatusOutboxEvent.findFirst({ where: { saleDocumentId: document.id }, orderBy: { statusVersion: 'desc' } });
      assert.ok(outbox);
      const first = await applySignedWebhook(outbox.payload);
      assert.equal(first.statusCode, 200);
      const sitePaid = await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } });
      assert.equal(sitePaid.paymentStatus, 'paid');
      const siteOrder = await site.order.findUniqueOrThrow({ where: { id: f.order.id } });
      assert.equal(siteOrder.status, 'confirmed');
      const repeated = await applySignedWebhook(outbox.payload);
      assert.equal(repeated.statusCode, 200);
      assert.equal(repeated.body.idempotent, true);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
      assert.equal((await confirmBankInvoicePayment(crm, document.id, { id: 77, role: 'manager', name: 'Менеджер тестов' })).idempotent, true);
      assert.equal(await crm.sale.count({ where: { documentId: document.id } }), 1);
    });

    await t.test('CRM commit followed by a lost HTTP response is retried without another stock hold', async () => {
      const f = await fixture();
      let drop = true;
      const lossy = createBankInvoiceDeliveryService(site, async (...args) => {
        const result = await transport(...args);
        if (drop) { drop = false; throw new Error('Simulated connection reset after CRM commit'); }
        return result;
      });
      assert.equal(await lossy.dispatch(f.event.id), false);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'preparing');
      await due(f.event.id);
      assert.equal(await lossy.dispatch(f.event.id), true);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
    });

    await t.test('concurrent SITE dispatch claims result in one remote document', async () => {
      const f = await fixture();
      await Promise.all(Array.from({ length: 5 }, () => delivery.dispatch(f.event.id)));
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'issued');
    });

    await t.test('concurrent CRM intake and duplicate release retain terminal identity and stock', async () => {
      const f = await fixture();
      const request = f.event.payload.request;
      const results = await Promise.all(Array.from({ length: 5 }, () => intakeBankInvoice(crm, request)));
      assert.equal(new Set(results.map(r => r.crmOrderId)).size, 1);
      assert.equal(new Set(results.map(r => r.documentNumber)).size, 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
      const release = { invoiceId: f.invoice.id, requestId: `bank-invoice-release:${f.invoice.id}`, reason: 'test' };
      await Promise.all(Array.from({ length: 5 }, () => releaseBankInvoice(crm, f.order.id, release)));
      const late = await intakeBankInvoice(crm, request);
      assert.equal(late.allocationStatus, 'released');
      assert.equal(late.crmOrderId, results[0].crmOrderId);
      assert.equal(late.documentNumber, results[0].documentNumber);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 5);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal(await delivery.dispatch(f.event.id), true);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'void');
    });

    await t.test('insufficient stock creates neither document nor issued invoice', async () => {
      const f = await fixture(0);
      assert.equal(await delivery.dispatch(f.event.id), false);
      assert.equal(await countDocuments(f.order.id), 0);
      assert.equal(await crm.invoiceAllocation.count({ where: { externalOrderId: f.order.id } }), 0);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'preparing');
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 0);
    });

    await t.test('two independent orders competing for the last item cannot oversell', async () => {
      const f = await fixture(1);
      const first = f.event.payload.request;
      const secondId = `${prefix}-competitor`;
      const second = { ...first, externalOrderId: secondId, invoiceId: secondId,
        invoiceNumber: `BI-${secondId}`, requestId: `bank-invoice-intake:${secondId}` };
      const results = await Promise.allSettled([intakeBankInvoice(crm, first), intakeBankInvoice(crm, second)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);
      assert.equal(await crm.saleDocument.count({ where: { externalOrderId: { in: [f.order.id, secondId] } } }), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 0);
    });

    for (const phase of ['before', 'after']) await t.test(`worker process exits ${phase} CRM commit and restart recovers the durable claim`, async () => {
      const f = await fixture();
      const child = spawnSync(process.execPath, [__filename], { env: { ...process.env,
        INVOICE_CRASH_EVENT: f.event.id, INVOICE_CRASH_PHASE: phase }, timeout: 20000, encoding: 'utf8' });
      assert.equal(child.status, 73, child.stderr);
      assert.equal((await site.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } })).status, 'processing');
      assert.equal(await countDocuments(f.order.id), phase === 'after' ? 1 : 0);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'preparing');
      // Advance persisted lease age, then invoke the actual existing outbox recovery.
      await site.outboxEvent.update({ where: { id: f.event.id }, data: { updatedAt: new Date(0) } });
      await require('../../src/services/crmOutbox.service').reconcileCrmOutbox();
      const restarted = createBankInvoiceDeliveryService(site, transport);
      assert.equal(await restarted.dispatch(f.event.id), true);
      const issued = await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } });
      assert.equal(issued.documentStatus, 'issued');
      assert.equal(await restarted.dispatch(f.event.id), false);
      assert.deepEqual(await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }), issued);
      assert.equal(await site.invoice.count({ where: { orderId: f.order.id } }), 1);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
    });

    await t.test('lease revoked during finalization rolls back real PostgreSQL invoice writes', async () => {
      const f = await fixture();
      let revoked = false;
      const racingDb = new Proxy(site, { get(target, key) {
        if (key !== '$transaction') return Reflect.get(target, key);
        return (fn, options) => target.$transaction(tx => fn(new Proxy(tx, { get(inner, property) {
          if (property !== 'invoice') return Reflect.get(inner, property);
          return new Proxy(inner.invoice, { get(model, operation) {
            if (operation !== 'update') return Reflect.get(model, operation);
            return async args => {
              if (!revoked && args.data.documentStatus === 'issued') {
                revoked = true;
                await site.outboxEvent.update({ where: { id: f.event.id }, data: {
                  status: 'pending', lockedAt: null, nextAttemptAt: new Date(0),
                } });
              }
              return model.update(args);
            };
          } });
        } })), options);
      } });
      assert.equal(await createBankInvoiceDeliveryService(racingDb, transport).dispatch(f.event.id), false);
      assert.equal(revoked, true);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'preparing');
      assert.equal((await site.order.findUniqueOrThrow({ where: { id: f.order.id } })).crmOrderId, null);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal(await delivery.dispatch(f.event.id), true);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'issued');
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 4);
    });

    await t.test('cancellation before dispatch durably releases/tombstones and never issues', async () => {
      const f = await fixture();
      await requestOrderCancellation(f.order.id, user.id, 'test cancel before send');
      const release = await site.outboxEvent.findFirst({ where: { aggregateId: f.order.id, type: BANK_INVOICE_RELEASE_TYPE } });
      assert.ok(release);
      await delivery.dispatch(release.id);
      await due(f.event.id);
      await delivery.dispatch(f.event.id);
      const canceled = await site.order.findUniqueOrThrow({ where: { id: f.order.id } });
      assert.equal(canceled.cancellationState, 'accepted');
      assert.equal(canceled.status, 'cancelled');
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'void');
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 5);
    });

    await t.test('cancel during a lost-response handoff releases exactly once and cannot be resurrected', async () => {
      const f = await fixture();
      let signalCommitted, resume;
      const committed = new Promise(resolve => { signalCommitted = resolve; });
      const gate = new Promise(resolve => { resume = resolve; });
      const heldReply = createBankInvoiceDeliveryService(site, async (...args) => {
        const result = await transport(...args);
        signalCommitted();
        await gate;
        return result;
      });
      const dispatching = heldReply.dispatch(f.event.id);
      await committed;
      await requestOrderCancellation(f.order.id, user.id, 'cancel during intake');
      const release = await site.outboxEvent.findFirst({ where: { aggregateId: f.order.id, type: BANK_INVOICE_RELEASE_TYPE } });
      assert.ok(release);
      await Promise.all([delivery.dispatch(release.id), delivery.dispatch(release.id)]);
      resume();
      await dispatching;
      await due(f.event.id);
      await delivery.dispatch(f.event.id);
      assert.equal(await countDocuments(f.order.id), 1);
      assert.equal((await crm.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 5);
      assert.equal((await site.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } })).documentStatus, 'void');
      assert.equal((await site.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'cancelled');
    });
  } finally {
    await Promise.all([site.$disconnect(), crm.$disconnect(), singleton.$disconnect()]);
  }
});
