-- Cancellation is separate from fulfillment and payment state. Existing rows
-- are explicitly non-cancelled; all audit fields are nullable and additive.
ALTER TABLE "Order"
  ADD COLUMN "cancellationState" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationResolvedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancellationDecisionReason" TEXT;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_cancellationState_valid"
  CHECK ("cancellationState" IN ('none', 'requested', 'accepted', 'rejected'));

CREATE INDEX "Order_cancellationState_idx" ON "Order"("cancellationState");

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "refundReason" TEXT,
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3);

ALTER TABLE "PaymentAttempt" DROP CONSTRAINT "PaymentAttempt_status_valid";
ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_status_valid" CHECK (
    "status" IN (
      'initiating', 'pending', 'unknown', 'succeeded', 'canceled', 'failed',
      'compensation_required', 'refund_required', 'refund_failed', 'refunded'
    )
  );

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_refundReason_valid" CHECK (
    "refundReason" IS NULL OR "refundReason" IN (
      'pre_handoff_compensation', 'pre_handoff_customer_cancellation',
      'post_handoff_cancellation'
    )
  );

ALTER TABLE "OutboxEvent" DROP CONSTRAINT "OutboxEvent_status_valid";
ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_status_valid" CHECK (
    "status" IN ('pending', 'processing', 'dispatched', 'completed', 'failed')
  );
