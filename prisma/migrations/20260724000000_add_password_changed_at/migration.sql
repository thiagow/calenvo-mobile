-- Rastreia quando a senha foi trocada por último, para invalidar sessões JWT emitidas antes da troca
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
