-- Idempotent migration: safe to run against a schema that may already be
-- partially applied (this DB has drifted from migration history in the
-- past — some changes were applied via `prisma db push`). Never rewrite
-- this to use `prisma migrate dev`/`reset`.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MessageTemplateKind" AS ENUM ('REACTIVATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReactivationMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Service
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "returnIntervalDays" INTEGER;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "reactivationTemplateId" TEXT;

-- CreateTable: MessageTemplate
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MessageTemplateKind" NOT NULL DEFAULT 'REACTIVATION',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReactivationMessage
CREATE TABLE IF NOT EXISTS "ReactivationMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "templateId" TEXT,
    "renderedBody" TEXT NOT NULL,
    "status" "ReactivationMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactivationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageTemplate_userId_kind_idx" ON "MessageTemplate"("userId", "kind");
CREATE INDEX IF NOT EXISTS "ReactivationMessage_userId_clientId_serviceId_createdAt_idx" ON "ReactivationMessage"("userId", "clientId", "serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReactivationMessage_userId_status_sentAt_idx" ON "ReactivationMessage"("userId", "status", "sentAt");
CREATE INDEX IF NOT EXISTS "Appointment_userId_clientId_date_idx" ON "Appointment"("userId", "clientId", "date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_reactivationTemplateId_fkey" FOREIGN KEY ("reactivationTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReactivationMessage" ADD CONSTRAINT "ReactivationMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReactivationMessage" ADD CONSTRAINT "ReactivationMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReactivationMessage" ADD CONSTRAINT "ReactivationMessage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReactivationMessage" ADD CONSTRAINT "ReactivationMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
