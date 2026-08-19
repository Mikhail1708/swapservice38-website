jest.unmock('@queues/crm.queue');

import crmQueue, {
  addOrderToCRMQueue,
  addUpdateToCRMQueue,
} from '../../../src/queues/crm.queue';

describe('CRM queue idempotency', () => {
  const queue = crmQueue as any;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'queued-job' });
  });

  it('uses a deterministic create job id and adds the external order id', async () => {
    await addOrderToCRMQueue('site-order-1', {
      source: 'website_retry',
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(queue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'createOrder',
        data: expect.objectContaining({
          orderId: 'site-order-1',
          orderData: expect.objectContaining({
            externalOrderId: 'site-order-1',
            source: 'website',
            sourceDetail: 'website_retry',
          }),
        }),
      }),
      expect.objectContaining({ jobId: 'crm-create-site-order-1' }),
    );
  });

  it('builds the same update job id for semantically identical payloads', async () => {
    await addUpdateToCRMQueue('site-order-1', 'crm-1', { comment: 'x', items: [] });
    await addUpdateToCRMQueue('site-order-1', 'crm-1', { items: [], comment: 'x' });

    const firstOptions = queue.add.mock.calls[0][1];
    const secondOptions = queue.add.mock.calls[1][1];
    expect(firstOptions.jobId).toBe(secondOptions.jobId);
    expect(firstOptions.jobId).toMatch(/^crm-update-site-order-1-[a-f0-9]{16}$/);
  });

  it('does not enqueue a duplicate existing job', async () => {
    const existingJob = { id: 'existing', isFailed: jest.fn().mockResolvedValue(false) };
    queue.getJob.mockResolvedValue(existingJob);

    await expect(addOrderToCRMQueue('site-order-1', {})).resolves.toBe(existingJob);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
