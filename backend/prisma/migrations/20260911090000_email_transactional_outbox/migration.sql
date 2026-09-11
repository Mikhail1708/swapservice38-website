-- Durable email intent. No existing business rows are modified.
CREATE TABLE "EmailOutboxEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
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
  CONSTRAINT "EmailOutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailOutboxEvent_deduplicationKey_key" ON "EmailOutboxEvent"("deduplicationKey");
CREATE INDEX "EmailOutboxEvent_status_nextAttemptAt_idx" ON "EmailOutboxEvent"("status", "nextAttemptAt");
CREATE INDEX "EmailOutboxEvent_status_lockedAt_idx" ON "EmailOutboxEvent"("status", "lockedAt");
CREATE INDEX "EmailOutboxEvent_aggregateId_eventType_idx" ON "EmailOutboxEvent"("aggregateId", "eventType");
