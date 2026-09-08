-- Additive only. Never infer consent from the existence of legacy users/orders.
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scopeVersion" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserConsent_userId_type_scopeVersion_key" ON "UserConsent"("userId", "type", "scopeVersion");
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD COLUMN "offerVersion" TEXT,
    ADD COLUMN "offerAcceptedAt" TIMESTAMP(3),
    ADD COLUMN "personalDataConsentId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_personalDataConsentId_fkey" FOREIGN KEY ("personalDataConsentId") REFERENCES "UserConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
