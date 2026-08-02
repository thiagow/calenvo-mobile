-- Idempotent migration: safe to run against a schema that may already be
-- partially applied (this DB has drifted from migration history in the
-- past — some changes were applied via `prisma db push`). Never rewrite
-- this to use `prisma migrate dev`/`reset`.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConfirmationOutcome" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CANCEL_REQUESTED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Appointment
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appointment_userId_status_date_idx" ON "Appointment"("userId", "status", "date");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppointmentConfirmation" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "outcome" "ConfirmationOutcome" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppointmentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentConfirmation_appointmentId_key" ON "AppointmentConfirmation"("appointmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentConfirmation_tokenHash_key" ON "AppointmentConfirmation"("tokenHash");
CREATE INDEX IF NOT EXISTS "AppointmentConfirmation_userId_outcome_expiresAt_idx" ON "AppointmentConfirmation"("userId", "outcome", "expiresAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AppointmentConfirmation" ADD CONSTRAINT "AppointmentConfirmation_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AppointmentConfirmation" ADD CONSTRAINT "AppointmentConfirmation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
