-- Additive SITE-only foundation. No existing payment/status/money fields change.
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentMethod_valid"
  CHECK ("paymentMethod" IN ('online', 'bank_invoice'));

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "documentStatus" TEXT NOT NULL DEFAULT 'preparing',
  "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "issuedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "sellerSnapshot" JSONB,
  "buyerSnapshot" JSONB NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "orderNumberSnapshot" TEXT,
  "paymentPurpose" TEXT,
  "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_amountMinor_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "Invoice_currency_rub" CHECK ("currency" = 'RUB'),
  CONSTRAINT "Invoice_snapshotVersion_valid" CHECK ("snapshotVersion" > 0),
  CONSTRAINT "Invoice_documentStatus_valid" CHECK ("documentStatus" IN ('preparing', 'issued', 'void', 'expired')),
  CONSTRAINT "Invoice_paymentStatus_valid" CHECK ("paymentStatus" IN ('unpaid', 'paid', 'refunded')),
  CONSTRAINT "Invoice_snapshots_valid" CHECK (
    jsonb_typeof("buyerSnapshot") = 'object' AND jsonb_typeof("itemsSnapshot") = 'array'
    AND jsonb_array_length("itemsSnapshot") > 0
  ),
  CONSTRAINT "Invoice_issuance_complete" CHECK (
    ("issuedAt" IS NULL AND "documentStatus" IN ('preparing', 'void')
      AND "invoiceNumber" IS NULL AND "dueAt" IS NULL AND "sellerSnapshot" IS NULL
      AND "orderNumberSnapshot" IS NULL AND "paymentPurpose" IS NULL)
    OR
    ("issuedAt" IS NOT NULL AND "documentStatus" IN ('issued', 'void', 'expired')
      AND "invoiceNumber" IS NOT NULL AND length(btrim("invoiceNumber")) > 0
      AND "dueAt" IS NOT NULL AND "dueAt" > "issuedAt"
      AND "sellerSnapshot" IS NOT NULL AND jsonb_typeof("sellerSnapshot") = 'object'
      AND "orderNumberSnapshot" IS NOT NULL AND length(btrim("orderNumberSnapshot")) > 0
      AND "paymentPurpose" IS NOT NULL AND length(btrim("paymentPurpose")) > 0)
  ),
  CONSTRAINT "Invoice_payment_consistent" CHECK (
    ("paymentStatus" = 'unpaid' AND "paidAt" IS NULL)
    OR ("paymentStatus" IN ('paid', 'refunded') AND "paidAt" IS NOT NULL AND "issuedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_documentStatus_dueAt_idx" ON "Invoice"("documentStatus", "dueAt");
CREATE INDEX "Invoice_paymentStatus_updatedAt_idx" ON "Invoice"("paymentStatus", "updatedAt");

-- Financial content remains immutable even through an accidental direct SQL write.
-- Status/payment changes do not alter the issued document; deletion is forbidden.
CREATE FUNCTION "protectIssuedInvoiceSnapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."issuedAt" IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Issued invoice cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW."id", NEW."orderId", NEW."invoiceNumber", NEW."amountMinor", NEW."currency",
      NEW."issuedAt", NEW."dueAt", NEW."sellerSnapshot", NEW."buyerSnapshot", NEW."itemsSnapshot",
      NEW."orderNumberSnapshot", NEW."paymentPurpose", NEW."snapshotVersion", NEW."createdAt")
      IS DISTINCT FROM
      ROW(OLD."id", OLD."orderId", OLD."invoiceNumber", OLD."amountMinor", OLD."currency",
      OLD."issuedAt", OLD."dueAt", OLD."sellerSnapshot", OLD."buyerSnapshot", OLD."itemsSnapshot",
      OLD."orderNumberSnapshot", OLD."paymentPurpose", OLD."snapshotVersion", OLD."createdAt") THEN
      RAISE EXCEPTION 'Issued invoice snapshot is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Invoice_immutable_snapshot"
  BEFORE UPDATE OR DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION "protectIssuedInvoiceSnapshot"();
