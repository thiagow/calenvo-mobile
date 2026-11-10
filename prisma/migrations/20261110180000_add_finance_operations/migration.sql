-- Idempotent migration: safe to run against a schema that may already be
-- partially applied (this DB has drifted from migration history in the
-- past — some changes were applied via `prisma db push`). Never rewrite
-- this to use `prisma migrate dev`/`reset`.
--
-- Módulo Financeiro — Fases 2 a 6: comanda, contas a receber e a pagar,
-- livro-razão, caixa, comissões, vales e acertos. Só ADICIONA: duas colunas
-- novas com default/nullable em tabelas existentes (User.canOperateCash,
-- ClientPackageItem.sessionValueCents) e tabelas novas. Nada é alterado ou
-- removido.

DO $$ BEGIN
  CREATE TYPE "SaleOrigin" AS ENUM ('APPOINTMENT', 'PACKAGE', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementEntryStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionKind" AS ENUM ('RECEIPT', 'PAYMENT', 'SUPPLY', 'WITHDRAWAL', 'COMMISSION_PAYOUT', 'ADVANCE', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionRuleType" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'SETTLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AdjustmentKind" AS ENUM ('ADVANCE', 'BONUS', 'DEDUCTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canOperateCash" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClientPackageItem" ADD COLUMN IF NOT EXISTS "sessionValueCents" INTEGER;

CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" "SaleOrigin" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'OPEN',
    "appointmentId" TEXT,
    "clientPackageId" TEXT,
    "clientId" TEXT,
    "description" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "professionalId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "clientPackageItemId" TEXT,
    "commissionBaseCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Receivable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saleId" TEXT,
    "clientId" TEXT,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "SettlementEntryStatus" NOT NULL DEFAULT 'OPEN',
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Payable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplier" TEXT,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "SettlementEntryStatus" NOT NULL DEFAULT 'OPEN',
    "seriesId" TEXT,
    "installment" INTEGER,
    "ofInstallments" INTEGER,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethodId" TEXT,
    "cashSessionId" TEXT,
    "receivableId" TEXT,
    "payableId" TEXT,
    "settlementId" TEXT,
    "adjustmentId" TEXT,
    "reversesId" TEXT,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCents" INTEGER NOT NULL DEFAULT 0,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "expectedCashCents" INTEGER,
    "countedCashCents" INTEGER,
    "differenceCents" INTEGER,
    "notes" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommissionRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "type" "CommissionRuleType" NOT NULL,
    "valueBps" INTEGER,
    "valueCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Commission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "ruleType" "CommissionRuleType" NOT NULL,
    "ruleValue" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "settlementId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProfessionalAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "kind" "AdjustmentKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "settlementId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommissionSettlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "commissionsCents" INTEGER NOT NULL,
    "bonusesCents" INTEGER NOT NULL DEFAULT 0,
    "deductionsCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PAID',
    "paymentMethodId" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_appointmentId_key" ON "Sale"("appointmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_clientPackageId_key" ON "Sale"("clientPackageId");

CREATE INDEX IF NOT EXISTS "Sale_userId_status_occurredAt_idx" ON "Sale"("userId", "status", "occurredAt");

CREATE INDEX IF NOT EXISTS "Sale_userId_occurredAt_idx" ON "Sale"("userId", "occurredAt");

CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");

CREATE INDEX IF NOT EXISTS "SaleItem_professionalId_idx" ON "SaleItem"("professionalId");

CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_saleId_key" ON "Receivable"("saleId");

CREATE INDEX IF NOT EXISTS "Receivable_userId_status_dueDate_idx" ON "Receivable"("userId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "Receivable_userId_clientId_idx" ON "Receivable"("userId", "clientId");

CREATE INDEX IF NOT EXISTS "Payable_userId_status_dueDate_idx" ON "Payable"("userId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "Payable_seriesId_idx" ON "Payable"("seriesId");

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialTransaction_adjustmentId_key" ON "FinancialTransaction"("adjustmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialTransaction_reversesId_key" ON "FinancialTransaction"("reversesId");

CREATE INDEX IF NOT EXISTS "FinancialTransaction_userId_occurredAt_idx" ON "FinancialTransaction"("userId", "occurredAt");

CREATE INDEX IF NOT EXISTS "FinancialTransaction_cashSessionId_idx" ON "FinancialTransaction"("cashSessionId");

CREATE INDEX IF NOT EXISTS "FinancialTransaction_receivableId_idx" ON "FinancialTransaction"("receivableId");

CREATE INDEX IF NOT EXISTS "FinancialTransaction_payableId_idx" ON "FinancialTransaction"("payableId");

CREATE INDEX IF NOT EXISTS "CashSession_userId_status_idx" ON "CashSession"("userId", "status");

CREATE INDEX IF NOT EXISTS "CashSession_userId_openedAt_idx" ON "CashSession"("userId", "openedAt");

CREATE INDEX IF NOT EXISTS "CommissionRule_userId_idx" ON "CommissionRule"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionRule_professionalId_serviceId_key" ON "CommissionRule"("professionalId", "serviceId");

CREATE UNIQUE INDEX IF NOT EXISTS "Commission_saleItemId_key" ON "Commission"("saleItemId");

CREATE INDEX IF NOT EXISTS "Commission_userId_professionalId_status_idx" ON "Commission"("userId", "professionalId", "status");

CREATE INDEX IF NOT EXISTS "Commission_settlementId_idx" ON "Commission"("settlementId");

CREATE INDEX IF NOT EXISTS "ProfessionalAdjustment_userId_professionalId_settlementId_idx" ON "ProfessionalAdjustment"("userId", "professionalId", "settlementId");

CREATE INDEX IF NOT EXISTS "CommissionSettlement_userId_professionalId_paidAt_idx" ON "CommissionSettlement"("userId", "professionalId", "paidAt");

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_clientPackageItemId_fkey" FOREIGN KEY ("clientPackageItemId") REFERENCES "ClientPackageItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payable" ADD CONSTRAINT "Payable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payable" ADD CONSTRAINT "Payable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CommissionSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "ProfessionalAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Commission" ADD CONSTRAINT "Commission_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Commission" ADD CONSTRAINT "Commission_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Commission" ADD CONSTRAINT "Commission_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CommissionSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalAdjustment" ADD CONSTRAINT "ProfessionalAdjustment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalAdjustment" ADD CONSTRAINT "ProfessionalAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CommissionSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalAdjustment" ADD CONSTRAINT "ProfessionalAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Garantias que o Prisma não expressa ---------------------------------------

-- Um único caixa aberto por tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_one_open_per_tenant"
  ON "CashSession"("userId") WHERE "status" = 'OPEN';

-- Uma única regra padrão (sem serviço) por profissional. O unique composto
-- não cobre NULL em Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionRule_default_per_professional"
  ON "CommissionRule"("professionalId") WHERE "serviceId" IS NULL;

-- Valores monetários nunca negativos; o sentido do dinheiro está em "direction".
DO $$ BEGIN
  ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_amounts_check"
    CHECK ("amountCents" > 0 AND "feeCents" >= 0 AND "feeCents" <= "amountCents");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_amounts_check"
    CHECK ("amountCents" >= 0 AND "paidCents" >= 0 AND "paidCents" <= "amountCents");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payable" ADD CONSTRAINT "Payable_amounts_check"
    CHECK ("amountCents" > 0 AND "paidCents" >= 0 AND "paidCents" <= "amountCents");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_amounts_check"
    CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "totalCents" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_amounts_check"
    CHECK ("quantity" > 0 AND "unitPriceCents" >= 0 AND "discountCents" >= 0
           AND "totalCents" >= 0 AND "feeCents" >= 0 AND "commissionBaseCents" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_value_check"
    CHECK (("type" = 'PERCENT' AND "valueBps" BETWEEN 0 AND 10000 AND "valueCents" IS NULL)
        OR ("type" = 'FIXED' AND "valueCents" >= 0 AND "valueBps" IS NULL));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalAdjustment" ADD CONSTRAINT "ProfessionalAdjustment_amount_check"
    CHECK ("amountCents" > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_opening_check"
    CHECK ("openingCents" >= 0 AND ("countedCashCents" IS NULL OR "countedCashCents" >= 0));
EXCEPTION WHEN duplicate_object THEN null; END $$;
