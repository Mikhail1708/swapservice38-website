-- Durable payment initiation records prevent an order from being deleted while
-- an external payment can still complete.
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "reservationId" TEXT,
    "reservationExpiresAt" TIMESTAMP(3),
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" TEXT NOT NULL DEFAULT 'initiating',
    "providerRequestStartedAt" TIMESTAMP(3),
    "providerConfirmedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId")
      REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAttempt_amountMinor_positive" CHECK ("amountMinor" >= 0),
    CONSTRAINT "PaymentAttempt_currency_rub" CHECK ("currency" = 'RUB'),
    CONSTRAINT "PaymentAttempt_status_valid" CHECK (
      "status" IN ('initiating', 'pending', 'unknown', 'succeeded', 'canceled', 'failed', 'compensation_required', 'refunded')
    )
);

CREATE UNIQUE INDEX "PaymentAttempt_orderId_key" ON "PaymentAttempt"("orderId");
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_providerPaymentId_key" ON "PaymentAttempt"("providerPaymentId");
CREATE UNIQUE INDEX "PaymentAttempt_reservationId_key" ON "PaymentAttempt"("reservationId");
CREATE INDEX "PaymentAttempt_status_updatedAt_idx" ON "PaymentAttempt"("status", "updatedAt");

-- Conservatively protect orders that already have a provider payment link.
INSERT INTO "PaymentAttempt" (
  "id", "orderId", "provider", "idempotencyKey", "providerPaymentId", "amountMinor",
  "currency", "status", "createdAt", "updatedAt"
)
SELECT
  'legacy_' || "id", "id",
  CASE WHEN "paymentId" LIKE 'mock_%' THEN 'mock' ELSE 'yookassa' END,
  'order-' || "id", "paymentId",
  ROUND("total" * 100)::INTEGER, 'RUB',
  CASE WHEN "status" = 'pending' THEN 'unknown' ELSE 'succeeded' END,
  "createdAt", "updatedAt"
FROM "Order"
WHERE "paymentId" IS NOT NULL;

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OutboxEvent_status_valid" CHECK (
      "status" IN ('pending', 'processing', 'dispatched', 'completed')
    ),
    CONSTRAINT "OutboxEvent_attempts_nonnegative" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "OutboxEvent_deduplicationKey_key" ON "OutboxEvent"("deduplicationKey");
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");
CREATE INDEX "OutboxEvent_aggregateId_type_idx" ON "OutboxEvent"("aggregateId", "type");

-- Backfill potentially stranded paid orders. CRM create is already idempotent
-- by externalOrderId, so replaying these events is safe.
INSERT INTO "OutboxEvent" (
  "id", "aggregateId", "type", "deduplicationKey", "payload",
  "status", "createdAt", "updatedAt"
)
SELECT
  'backfill_' || "id", "id", 'crm_order_create_requested',
  'crm-order-create:' || "id", jsonb_build_object('orderId', "id"),
  'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Order"
WHERE "crmOrderId" IS NULL AND "status" IN ('paid', 'crm_failed')
ON CONFLICT ("deduplicationKey") DO NOTHING;
