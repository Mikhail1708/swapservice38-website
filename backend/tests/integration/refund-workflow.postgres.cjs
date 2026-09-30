// Run after migrate deploy on an isolated local refund_workflow_test_* database.
// Real PostgreSQL Order locks/outbox CAS; HTTP is strictly mocked, never sent.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const url = new URL(process.env.REFUND_TEST_DATABASE_URL || 'http://invalid');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
assert.match(url.pathname, /^\/refund_workflow_test_[a-z0-9_]+$/);
assert.equal(url.search, '');
url.searchParams.set('connection_limit', '4');
process.env.DATABASE_URL = url.href;
process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER = 'yookassa';
process.env.YOO_KASSA_SHOP_ID = 'isolated-refund-test';
process.env.YOO_KASSA_SECRET_KEY = 'fake-test-only';
require('ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../../tsconfig.json') });
for (const modulePath of ['../../src/queues/crm.queue', '../../src/services/payment.service']) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true,
    exports: new Proxy({}, { get: () => () => { throw new Error('Unexpected unrelated transport'); } }) };
}
const axios = require('axios');
axios.defaults.adapter = async () => { throw new Error('Network forbidden in refund integration test'); };
let get, post, calls;
axios.get = async (...args) => { calls.get.push(args); return get(...args); };
axios.post = async (...args) => { calls.post.push(args); return post(...args); };
const { prisma: db } = require('../../src/config/prisma');
const { dispatchPaymentRefundEvent, ensurePaymentRefundOutboxEvent } = require('../../src/services/crmOutbox.service');
const { lockPaymentWorkflowOrder } = require('../../src/services/paymentWorkflowLock.service');
const prefix = `refund-pg-${randomUUID()}`;
let owner, serial = 0;
function providerPayment(paymentId, refundable = true, refunded = '0.00') {
  return { data: { id: paymentId, status: 'succeeded', paid: true, refundable,
    amount: { value: '2.00', currency: 'RUB' }, refunded_amount: { value: refunded, currency: 'RUB' } } };
}
function providerRefund(paymentId, status = 'succeeded') {
  return { data: { id: `refund-${paymentId}`, payment_id: paymentId, status,
    amount: { value: '2.00', currency: 'RUB' } } };
}
async function fixture() {
  const orderId = `${prefix}-${++serial}`, paymentId = `payment-${orderId}`;
  const order = await db.order.create({ data: { id: orderId, userId: owner.id, deliveryMethod: 'pickup',
    items: [], total: 2, status: 'cancelled', cancellationState: 'accepted', crmOrderId: `crm-${orderId}` } });
  await db.paymentAttempt.create({ data: { orderId, provider: 'yookassa', providerPaymentId: paymentId,
    idempotencyKey: `payment-key-${orderId}`, amountMinor: 200, currency: 'RUB', status: 'refund_required' } });
  const event = await ensurePaymentRefundOutboxEvent(db, order.id, paymentId, 200, 'RUB', 'post_handoff_cancellation');
  calls = { get: [], post: [] };
  get = async requestUrl => { assert.ok(requestUrl.endsWith(`/payments/${paymentId}`)); return providerPayment(paymentId); };
  post = async (requestUrl, body, config) => {
    assert.equal(requestUrl, 'https://api.yookassa.ru/v3/refunds');
    assert.equal(body.payment_id, paymentId);
    assert.equal(config.headers['Idempotence-Key'], event.deduplicationKey);
    return providerRefund(paymentId);
  };
  return { orderId, paymentId, event };
}
const due = id => db.outboxEvent.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
const eventState = id => db.outboxEvent.findUniqueOrThrow({ where: { id } });
const attemptState = orderId => db.paymentAttempt.findUniqueOrThrow({ where: { orderId } });

test('real PostgreSQL durable YooKassa refund workflow', async t => {
  try {
    owner = await db.user.create({ data: { email: `${prefix}@example.test` } });
    await t.test('not refundable waits beyond eight checks; later concurrent dispatch uses same intent once', async () => {
      const { orderId, paymentId, event } = await fixture();
      get = async () => providerPayment(paymentId, false);
      for (let n = 0; n < 10; n++) {
        await due(event.id);
        assert.equal(await dispatchPaymentRefundEvent(event.id), false);
        const waiting = await eventState(event.id);
        assert.equal(waiting.status, 'pending');
        assert.equal(waiting.processedAt, null);
        assert.equal(waiting.attempts, 0);
        assert.ok(waiting.nextAttemptAt.getTime() > Date.now() + 240_000);
      }
      assert.equal(calls.post.length, 0);
      assert.equal((await attemptState(orderId)).status, 'refund_required');
      assert.equal((await ensurePaymentRefundOutboxEvent(db, orderId, paymentId, 200, 'RUB', 'post_handoff_cancellation')).id, event.id);
      await due(event.id);
      get = async () => providerPayment(paymentId, true);
      const results = await Promise.all([dispatchPaymentRefundEvent(event.id), dispatchPaymentRefundEvent(event.id)]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.equal(calls.post.length, 1);
      const attempt = await attemptState(orderId);
      assert.equal(attempt.status, 'refunded');
      assert.equal(attempt.refundId, `refund-${paymentId}`);
      assert.ok(attempt.refundedAt);
      assert.equal(attempt.lastError, null);
      assert.equal((await eventState(event.id)).status, 'completed');
      assert.equal(await dispatchPaymentRefundEvent(event.id), false);
      assert.equal(calls.post.length, 1);
      assert.equal(await db.outboxEvent.count({ where: { aggregateId: orderId, type: 'payment_refund_requested' } }), 1);
    });
    await t.test('Order row lock serializes preflight with cancellation/payment writer', async () => {
      const { orderId, event } = await fixture();
      let release, locked;
      const lockReady = new Promise(resolve => { locked = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const writer = db.$transaction(async tx => {
        await lockPaymentWorkflowOrder(tx, orderId);
        locked();
        await gate;
      });
      await lockReady;
      const dispatch = dispatchPaymentRefundEvent(event.id);
      try {
        const deadline = Date.now() + 2000;
        while ((await eventState(event.id)).status !== 'processing') {
          assert.ok(Date.now() < deadline, 'dispatcher must claim its event');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.equal(calls.get.length, 0, 'provider preflight must wait for the Order lock');
      } finally { release(); }
      await writer;
      assert.equal(await dispatch, true);
      assert.equal(calls.post.length, 1);
    });
    await t.test('GET timeout retries safely without POST or terminal state', async () => {
      const { orderId, paymentId, event } = await fixture();
      get = async () => { throw Object.assign(new Error('test timeout'), { code: 'ETIMEDOUT' }); };
      assert.equal(await dispatchPaymentRefundEvent(event.id), false);
      assert.equal((await eventState(event.id)).status, 'pending');
      assert.equal((await attemptState(orderId)).status, 'refund_required');
      assert.equal(calls.post.length, 0);
      await due(event.id);
      get = async () => providerPayment(paymentId);
      assert.equal(await dispatchPaymentRefundEvent(event.id), true);
      assert.equal(calls.post.length, 1);
    });
    await t.test('provider full refund reconciles without a second POST', async () => {
      const { orderId, paymentId, event } = await fixture();
      get = async () => providerPayment(paymentId, false, '2.00');
      assert.equal(await dispatchPaymentRefundEvent(event.id), true);
      assert.equal((await attemptState(orderId)).status, 'refunded');
      assert.equal(calls.post.length, 0);
    });
    await t.test('pending provider refund retains identity and polls GET refund, no repeat POST', async () => {
      const { orderId, paymentId, event } = await fixture();
      post = async () => providerRefund(paymentId, 'pending');
      assert.equal(await dispatchPaymentRefundEvent(event.id), false);
      assert.equal((await attemptState(orderId)).refundId, `refund-${paymentId}`);
      assert.equal((await eventState(event.id)).status, 'pending');
      await due(event.id);
      get = async requestUrl => requestUrl.includes('/refunds/') ? providerRefund(paymentId) : providerPayment(paymentId);
      assert.equal(await dispatchPaymentRefundEvent(event.id), true);
      assert.equal(calls.post.length, 1);
    });
    await t.test('lost POST response reuses the same idempotency key on retry', async () => {
      const { paymentId, event } = await fixture();
      post = async () => { throw Object.assign(new Error('lost response'), { code: 'ETIMEDOUT' }); };
      assert.equal(await dispatchPaymentRefundEvent(event.id), false);
      const started = (await eventState(event.id)).payload.refundPostStartedAt;
      assert.ok(started);
      await due(event.id);
      post = async () => providerRefund(paymentId);
      assert.equal(await dispatchPaymentRefundEvent(event.id), true);
      assert.deepEqual(calls.post.map(call => call[2].headers['Idempotence-Key']), [event.deduplicationKey, event.deduplicationKey]);
      assert.equal((await eventState(event.id)).payload.refundPostStartedAt, started);
    });
  } finally { await db.$disconnect(); }
});
