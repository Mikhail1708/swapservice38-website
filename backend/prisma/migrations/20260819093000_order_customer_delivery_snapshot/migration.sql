ALTER TABLE "Order"
  ADD COLUMN "customerFirstName" TEXT,
  ADD COLUMN "customerLastName" TEXT,
  ADD COLUMN "customerMiddleName" TEXT,
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "contactMethod" TEXT NOT NULL DEFAULT 'phone',
  ADD COLUMN "deliveryProvider" TEXT;
