import axios from 'axios';
import { paymentHttpTimeoutMs } from '../config/paymentHttp';
import { paymentAmountMinor } from './paymentValidation.service';

export class RefundProviderError extends Error {
  constructor(public readonly code: string, public readonly temporary = false,
    public readonly state?: { status?: string; refundable?: boolean }) { super(code); }
}

export function refundFailure(error: any) {
  const status = Number(error?.response?.status) || undefined;
  const rawCode = error?.response?.data?.code;
  // Do not copy provider descriptions: they may echo request data/credentials.
  const descriptions: Record<string, string> = {
    invalid_request: 'Invalid refund request; review the indicated parameter',
    invalid_credentials: 'Provider authentication failed', forbidden: 'Provider rejected the operation',
    not_found: 'Provider object not found', too_many_requests: 'Provider rate limit',
    internal_server_error: 'Provider temporarily unavailable',
  };
  const code = error instanceof RefundProviderError ? error.code
    : Object.prototype.hasOwnProperty.call(descriptions, rawCode) ? rawCode : 'REFUND_PROVIDER_REQUEST_FAILED';
  const rawParameter = error?.response?.data?.parameter;
  const parameter = ['payment_id', 'amount', 'amount.value', 'amount.currency', 'receipt', 'Idempotence-Key'].includes(rawParameter) ? rawParameter : undefined;
  return { terminal: error instanceof RefundProviderError ? !error.temporary
    : Boolean(status && status >= 400 && status < 500 && ![408, 429].includes(status)),
    diagnostic: { code, httpStatus: status, description: descriptions[code] || code, parameter,
      ...(error instanceof RefundProviderError ? error.state : {}) } };
}

type RefundInput = { paymentId: string; amountMinor: number; currency: string; orderId: string;
  reason: string; idempotencyKey: string; refundId: string | null;
  beforePost: () => Promise<void>; saveRefundId: (id: string) => Promise<void>;
  onNotRefundableRejection: () => Promise<void> };

/** Provider truth only. Local eligibility, ownership and final state stay in the outbox transaction. */
export async function reconcileYooKassaRefund(input: RefundInput): Promise<{ refundId: string | null }> {
  const shop = process.env.YOO_KASSA_SHOP_ID;
  const secret = process.env.YOO_KASSA_SECRET_KEY;
  if (!shop || !secret) throw new RefundProviderError('REFUND_CREDENTIALS_MISSING');
  const config = { timeout: paymentHttpTimeoutMs(), headers: { 'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${shop}:${secret}`).toString('base64')}` } };
  const paymentUrl = `https://api.yookassa.ru/v3/payments/${encodeURIComponent(input.paymentId)}`;
  const checkPayment = (payment: any) => {
    if (payment?.id !== input.paymentId || payment.amount?.currency !== input.currency
      || paymentAmountMinor(payment) !== input.amountMinor) throw new RefundProviderError('REFUND_PAYMENT_IDENTITY_MISMATCH');
    if (payment.status !== 'succeeded' || payment.paid !== true) throw new RefundProviderError('REFUND_PAYMENT_NOT_PAID');
    const refunded = payment.refunded_amount === undefined ? 0 : paymentAmountMinor({ amount: payment.refunded_amount });
    if (!Number.isSafeInteger(refunded) || refunded < 0 || refunded > input.amountMinor
      || (payment.refunded_amount && payment.refunded_amount.currency !== input.currency)) throw new RefundProviderError('REFUND_INVALID_PROVIDER_AMOUNT');
    if (refunded > 0 && refunded !== input.amountMinor) throw new RefundProviderError('REFUND_PARTIAL_REQUIRES_REVIEW');
    return refunded === input.amountMinor;
  };
  const payment = (await axios.get(paymentUrl, config)).data;
  const fullyRefunded = checkPayment(payment);
  if (fullyRefunded) return { refundId: input.refundId };

  const checkRefund = async (refund: any) => {
    if (!refund?.id || typeof refund.id !== 'string' || refund.payment_id !== input.paymentId
      || refund.amount?.currency !== input.currency || paymentAmountMinor(refund) !== input.amountMinor
      || (input.refundId && refund.id !== input.refundId)) throw new RefundProviderError('REFUND_RESPONSE_IDENTITY_MISMATCH');
    await input.saveRefundId(refund.id);
    if (refund.status === 'succeeded') return { refundId: refund.id as string };
    if (refund.status === 'pending') throw new RefundProviderError('REFUND_PROVIDER_PENDING', true);
    throw new RefundProviderError('REFUND_PROVIDER_CANCELED');
  };
  if (input.refundId) {
    return checkRefund((await axios.get(`https://api.yookassa.ru/v3/refunds/${encodeURIComponent(input.refundId)}`, config)).data);
  }
  if (payment.refundable !== true) throw new RefundProviderError('REFUND_WAITING_PROVIDER', true,
    { status: 'succeeded', refundable: payment.refundable === false ? false : undefined });
  await input.beforePost();
  let response;
  try {
    response = await axios.post('https://api.yookassa.ru/v3/refunds', {
      payment_id: input.paymentId, amount: { value: (input.amountMinor / 100).toFixed(2), currency: input.currency },
      description: `Automatic ${input.reason} refund for order ${input.orderId}`,
    }, { ...config, headers: { ...config.headers, 'Idempotence-Key': input.idempotencyKey } });
  } catch (error: any) {
    // refundable can change between GET and POST. Confirm this before classifying a 403.
    if (error?.response?.status === 403) {
      const current = (await axios.get(paymentUrl, config)).data;
      if (checkPayment(current)) return { refundId: input.refundId };
      if (current.refundable === false) {
        await input.onNotRefundableRejection();
        throw new RefundProviderError('REFUND_WAITING_PROVIDER', true, { status: 'succeeded', refundable: false });
      }
    }
    throw error;
  }
  return checkRefund(response.data);
}
