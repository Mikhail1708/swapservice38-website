-- Refuse to silently discard identifiers if legacy duplicate data exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Order" WHERE "crmOrderId" IS NOT NULL
    GROUP BY "crmOrderId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique crmOrderId index: duplicate values exist in Order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Order" WHERE "orderNumber" IS NOT NULL
    GROUP BY "orderNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique orderNumber index: duplicate values exist in Order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Order" WHERE "paymentId" IS NOT NULL
    GROUP BY "paymentId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique paymentId index: duplicate values exist in Order';
  END IF;
END $$;

ALTER TABLE "Order"
ADD COLUMN "crmStatusVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Order_crmOrderId_key" ON "Order"("crmOrderId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_paymentId_key" ON "Order"("paymentId");
