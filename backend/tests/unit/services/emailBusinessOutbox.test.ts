import Queue from 'bull';
import nodemailer from 'nodemailer';

// Use real producers and persistence, with only external transports mocked by setup.
const emails = jest.requireActual('../../../src/services/email.service') as typeof import('../../../src/services/email.service');
const queues = (Queue as unknown as jest.Mock).mock.results.map(result => result.value);
const emailWorker = queues[0].process.mock.calls[0][0];

const order = {
  orderId: 'email-order-1', documentNumber: 'WEB-1', customerName: 'Customer',
  customerEmail: 'customer@example.test', customerPhone: '+79990000000', total: 100,
  items: [{ name: 'Product', quantity: 1, price: 100, total: 100 }],
  deliveryAddress: '', comment: '',
};

// Models commit/rollback only; no PostgreSQL, Redis or SMTP calls are performed.
function transactionalStore() {
  let committed = new Map<string, any>();
  let state = 'pending';
  const transaction = async (fn: (tx: any) => Promise<void>, failure?: Error) => {
    const staged = new Map(committed);
    let stagedState = state;
    const tx = {
      order: { update: jest.fn(async ({ data }: any) => { stagedState = data.status; }) },
      emailOutboxEvent: {
        upsert: jest.fn(async ({ where, create }: any) => {
          if (failure) throw failure;
          const key = where.deduplicationKey;
          if (!staged.has(key)) staged.set(key, { id: `event-${staged.size}`, status: 'pending', ...create });
          return staged.get(key);
        }),
      },
    };
    await fn(tx);
    committed = staged;
    state = stagedState;
  };
  return { transaction, rows: () => [...committed.values()], state: () => state };
}

describe('Business email transactional producers (F20)', () => {
  const oldUrl = process.env.PUBLIC_APP_URL;
  beforeAll(() => { process.env.PUBLIC_APP_URL = 'https://example.test'; });
  afterAll(() => {
    if (oldUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = oldUrl;
  });
  beforeEach(() => { jest.clearAllMocks(); });

  const expectNoDelivery = () => {
    expect(queues.length).toBeGreaterThan(0);
    for (const queue of queues) if (queue?.add) expect(queue.add).not.toHaveBeenCalled();
    expect(nodemailer.createTransport({}).sendMail).not.toHaveBeenCalled();
  };

  it('persists order-created customer and manager events in the supplied business transaction without enqueue', async () => {
    const store = transactionalStore();
    await store.transaction(async tx => {
      await tx.order.update({ data: { status: 'created' } });
      await emails.sendOrderCreatedToCustomer(order, tx);
      await emails.sendOrderNotificationToManager(order, tx);
      expect(store.rows()).toHaveLength(0); // Still uncommitted.
      expect(tx.emailOutboxEvent.upsert).toHaveBeenCalledTimes(2);
      expectNoDelivery();
    });
    expect(store.state()).toBe('created');
    expect(store.rows()).toHaveLength(2);
    expect(store.rows().every(row => row.status === 'pending')).toBe(true);
    expect(store.rows().map(row => row.payload.to)).toContain(order.customerEmail);
  });

  it('repeated order-created processing retains one event per recipient', async () => {
    const store = transactionalStore();
    for (let replay = 0; replay < 2; replay++) await store.transaction(async tx => {
      await emails.sendOrderCreatedToCustomer(order, tx);
      await emails.sendOrderNotificationToManager(order, tx);
    });
    expect(store.rows()).toHaveLength(2);
    expectNoDelivery();
  });

  it('payment-success replay retains one customer and one manager event distinct from order-created', async () => {
    const store = transactionalStore();
    await store.transaction(async tx => {
      await emails.sendOrderCreatedToCustomer(order, tx);
      await emails.sendOrderNotificationToManager(order, tx);
    });
    for (let replay = 0; replay < 2; replay++) await store.transaction(async tx => {
      await emails.sendOrderConfirmationToCustomer(order, tx);
      await emails.sendOrderNotificationToManager(order, tx, 'payment_succeeded');
    });
    expect(store.rows()).toHaveLength(4);
    expect(new Set(store.rows().map(row => row.deduplicationKey)).size).toBe(4);
    expectNoDelivery();
  });

  it('duplicate cancellation callback version retains one customer event', async () => {
    const store = transactionalStore();
    const cancellation = { ...order, status: 'cancelled', version: 7 };
    for (let replay = 0; replay < 2; replay++) await store.transaction(async tx => {
      await emails.sendOrderStatusUpdateToCustomer(cancellation, tx);
    });
    expect(store.rows()).toHaveLength(1);
    expect(store.rows()[0].payload.to).toBe(order.customerEmail);
    expectNoDelivery();
  });

  it('outbox failure propagates and rolls back the staged business transition', async () => {
    const store = transactionalStore();
    const error = new Error('database insert unavailable');
    await expect(store.transaction(async tx => {
      await tx.order.update({ data: { status: 'paid' } });
      await emails.sendOrderConfirmationToCustomer(order, tx);
    }, error)).rejects.toBe(error);
    expect(store.state()).toBe('pending');
    expect(store.rows()).toEqual([]);
    expectNoDelivery();
  });

  it('later business failure rolls back already-staged email events without sending them', async () => {
    const store = transactionalStore();
    await expect(store.transaction(async tx => {
      await emails.sendOrderCreatedToCustomer(order, tx);
      throw new Error('business transaction rolled back');
    })).rejects.toThrow('business transaction rolled back');
    expect(store.rows()).toEqual([]);
    expectNoDelivery();
  });

  it('missing customer email does not create an undeliverable customer event', async () => {
    const store = transactionalStore();
    await store.transaction(async tx => {
      await emails.sendOrderCreatedToCustomer({ ...order, customerEmail: '' }, tx);
      await emails.sendOrderConfirmationToCustomer({ ...order, customerEmail: '' }, tx);
      await emails.sendOrderStatusUpdateToCustomer({ ...order, customerEmail: '', status: 'cancelled', version: 1 }, tx);
    });
    expect(store.rows()).toEqual([]);
    expectNoDelivery();
  });

  it('outbox enqueue retains deterministic Bull identity and SMTP retry options', async () => {
    const payload = { to: order.customerEmail, subject: 'Order', html: '<p>Order</p>', text: 'Order' };
    await emails.enqueueOutboxEmail(payload, 'email-outbox-event-1');
    await emails.enqueueOutboxEmail(payload, 'email-outbox-event-1');
    expect(queues[0].add).toHaveBeenCalledTimes(2);
    for (const call of queues[0].add.mock.calls) expect(call[1]).toEqual({
      jobId: 'email-outbox-event-1', attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false, removeOnFail: false,
    });
  });

  it('SMTP worker rejects on transport failure so Bull can retry the retained job', async () => {
    const error = new Error('SMTP timeout');
    (nodemailer.createTransport({}).sendMail as jest.Mock).mockRejectedValueOnce(error);
    await expect(emailWorker({ data: { to: order.customerEmail, subject: 'Order', html: 'Order' } })).rejects.toBe(error);
  });
});
