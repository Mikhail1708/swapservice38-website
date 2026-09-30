// Run after migrate deploy on a NEW disposable invoice_number_test_* database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const url = new URL(process.env.INVOICE_NUMBER_TEST_DATABASE_URL || 'http://invalid');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
assert.match(url.pathname, /^\/invoice_number_test_[a-z0-9_]+$/);
assert.equal(url.search, '');
process.env.DATABASE_URL = url.href;
require('ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../../tsconfig.json') });
const { PrismaClient } = require('@prisma/client');
const { prisma: singleton } = require('../../src/config/prisma');
const { ensureBankInvoiceIntake } = require('../../src/services/bankInvoiceDelivery.service');
const { lockPaymentWorkflowOrder } = require('../../src/services/paymentWorkflowLock.service');
const db = new PrismaClient();
const invoice = id => ({ id, documentStatus: 'preparing', paymentStatus: 'unpaid', amountMinor: 100n,
  currency: 'RUB', buyerSnapshot: {}, itemsSnapshot: [] });
const number = event => event.payload.request.invoiceNumber;
const migration = fs.readFileSync(path.resolve(__dirname,
  '../../prisma/migrations/20260930120000_bank_invoice_number_sequence/migration.sql'), 'utf8');

test('PostgreSQL invoice sequence, immutable retry and concurrency', async t => {
  try {
    const state = await db.$queryRaw`SELECT last_value, is_called FROM bank_invoice_number_seq`;
    assert.deepEqual(state, [{ last_value: 10001n, is_called: false }], 'Use a fresh migrated disposable database');
    const owner = await db.user.create({ data: { email: 'number-test@example.test' } });
    async function order(id) {
      return db.order.create({ data: { id, userId: owner.id, paymentMethod: 'bank_invoice',
        deliveryMethod: 'pickup', items: [], total: 1 } });
    }
    async function create(record) {
      return db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, record.id);
        return ensureBankInvoiceIntake(tx, record, invoice(record.id));
      });
    }
    const firstOrder = await order('number-first');
    await t.test('starts 10001, then 10002; migration preserves existing sequence state', async () => {
      assert.equal(number(await create(firstOrder)), '10001');
      await db.$executeRawUnsafe(migration);
      assert.equal(number(await create(await order('number-second'))), '10002');
    });
    await t.test('concurrent different orders receive distinct five-digit numbers', async () => {
      const orders = await Promise.all([order('number-third'), order('number-fourth')]);
      const values = (await Promise.all(orders.map(create))).map(number);
      assert.equal(new Set(values).size, 2);
      values.forEach(value => assert.match(value, /^\d{5}$/));
    });
    await t.test('concurrent retry keeps original request without advancing sequence', async () => {
      const before = await db.$queryRaw`SELECT last_value FROM bank_invoice_number_seq`;
      const results = await Promise.all([create(firstOrder), create(firstOrder)]);
      assert.deepEqual(results.map(number), ['10001', '10001']);
      assert.deepEqual(await db.$queryRaw`SELECT last_value FROM bank_invoice_number_seq`, before);
    });
    await t.test('legacy immutable request is reused', async () => {
      const old = await order('number-legacy');
      await db.outboxEvent.create({ data: { aggregateId: old.id, type: 'bank_invoice_intake_requested',
        deduplicationKey: `bank-invoice-intake:${old.id}`, payload: { request: { invoiceNumber: 'BI-2026-old' } } } });
      assert.equal(number(await create(old)), 'BI-2026-old');
    });
    await t.test('99999 is final; exhaustion fails without persisting an event', async () => {
      await db.$queryRaw`SELECT setval('bank_invoice_number_seq', 99999, false)`;
      assert.equal(number(await create(await order('number-last'))), '99999');
      const overflow = await order('number-overflow');
      await assert.rejects(create(overflow), /maximum value|2200H/);
      assert.equal(await db.outboxEvent.count({ where: { aggregateId: overflow.id } }), 0);
    });
  } finally {
    await db.$disconnect();
    await singleton.$disconnect();
  }
});
