-- Idempotent migration: safe to run against a schema that may already be
-- partially applied (this DB has drifted from migration history in the
-- past — some changes were applied via `prisma db push`). Never rewrite
-- this to use `prisma migrate dev`/`reset`.
--
-- Módulo Financeiro — Fase 1 (fundação): direito de uso de módulos
-- opcionais, configuração do financeiro, formas de pagamento e categorias.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FeatureKey" AS ENUM ('FINANCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureSource" AS ENUM ('ADDON', 'GRANT', 'PLAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureStatus" AS ENUM ('ACTIVE', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionBase" AS ENUM ('AFTER_DISCOUNT', 'AFTER_FEES');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'PIX', 'DEBIT', 'CREDIT', 'TRANSFER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FinanceCategoryKind" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: TenantFeature
CREATE TABLE IF NOT EXISTS "TenantFeature" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" "FeatureKey" NOT NULL,
  "source" "FeatureSource" NOT NULL,
  "status" "FeatureStatus" NOT NULL DEFAULT 'ACTIVE',
  "stripeSubscriptionItemId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeature_userId_feature_key" ON "TenantFeature"("userId", "feature");
DO $$ BEGIN
  ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: FinanceConfig
CREATE TABLE IF NOT EXISTS "FinanceConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "activatedAt" TIMESTAMP(3),
  "commissionBase" "CommissionBase" NOT NULL DEFAULT 'AFTER_DISCOUNT',
  "requireOpenCashSession" BOOLEAN NOT NULL DEFAULT true,
  "settleOnlyPaidCommissions" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceConfig_userId_key" ON "FinanceConfig"("userId");
DO $$ BEGIN
  ALTER TABLE "FinanceConfig" ADD CONSTRAINT "FinanceConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: PaymentMethod
CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PaymentMethodType" NOT NULL,
  "feeBps" INTEGER NOT NULL DEFAULT 0,
  "feeFixedCents" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentMethod_fee_check" CHECK ("feeBps" BETWEEN 0 AND 10000 AND "feeFixedCents" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentMethod_userId_name_key" ON "PaymentMethod"("userId", "name");
CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_isActive_idx" ON "PaymentMethod"("userId", "isActive");
DO $$ BEGIN
  ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: FinanceCategory
CREATE TABLE IF NOT EXISTS "FinanceCategory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "FinanceCategoryKind" NOT NULL,
  "name" TEXT NOT NULL,
  "systemKey" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceCategory_userId_kind_name_key" ON "FinanceCategory"("userId", "kind", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceCategory_userId_systemKey_key" ON "FinanceCategory"("userId", "systemKey");
CREATE INDEX IF NOT EXISTS "FinanceCategory_userId_kind_isActive_idx" ON "FinanceCategory"("userId", "kind", "isActive");
DO $$ BEGIN
  ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
