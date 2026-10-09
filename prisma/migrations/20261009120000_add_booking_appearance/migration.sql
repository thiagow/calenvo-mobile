-- Idempotent migration: safe to run against a schema that may already be
-- partially applied (this DB has drifted from migration history in the
-- past — some changes were applied via `prisma db push`). Never rewrite
-- this to use `prisma migrate dev`/`reset`.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BookingTemplate" AS ENUM ('NATURAL', 'VIBRANT', 'CLEAN', 'DARK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: BusinessConfig
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingTemplate" "BookingTemplate" NOT NULL DEFAULT 'NATURAL';
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingBgColor" TEXT;
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingTextColor" TEXT;
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingAccentColor" TEXT;
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingCoverEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "bookingCoverImage" TEXT;
