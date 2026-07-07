-- Rename PlanType enum values (non-destructive, preserves existing data)
-- FREEMIUM (free tier) is being discontinued: all plans now require payment.
ALTER TYPE "PlanType" RENAME VALUE 'FREEMIUM' TO 'BASICO';
ALTER TYPE "PlanType" RENAME VALUE 'STANDARD' TO 'PRO';
ALTER TYPE "PlanType" RENAME VALUE 'PREMIUM' TO 'BUSINESS';

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "planType" SET DEFAULT 'BASICO',
  ADD COLUMN "billingInterval" "BillingInterval",
  ADD COLUMN "isPaymentExempt" BOOLEAN NOT NULL DEFAULT false;
