import { paymentHttpTimeoutMs } from '../../../src/config/paymentHttp';

describe('F19 provider HTTP timeout configuration', () => {
  const original = process.env.PAYMENT_HTTP_TIMEOUT_MS;
  afterEach(() => {
    if (original === undefined) delete process.env.PAYMENT_HTTP_TIMEOUT_MS;
    else process.env.PAYMENT_HTTP_TIMEOUT_MS = original;
  });
  it('defaults to 15000 when missing', () => {
    delete process.env.PAYMENT_HTTP_TIMEOUT_MS;
    expect(paymentHttpTimeoutMs()).toBe(15000);
  });
  it.each(['', ' ', 'NaN', 'Infinity', '0', '-1', '1.5', '1e3', '120001', '99999999999999999999'])('defaults safely for invalid value %j', value => {
    process.env.PAYMENT_HTTP_TIMEOUT_MS = value;
    expect(paymentHttpTimeoutMs()).toBe(15000);
  });
  it.each(['1', ' 4321 ', '120000'])('accepts a bounded integer %j', value => {
    process.env.PAYMENT_HTTP_TIMEOUT_MS = value;
    expect(paymentHttpTimeoutMs()).toBe(Number(value));
  });
});
