-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BRL', 'USD');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'BRL',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'pt';
