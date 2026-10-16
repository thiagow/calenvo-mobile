-- Bloqueio pessoal de profissional: coluna anulável (null = bloqueio da agenda inteira, como sempre foi).
ALTER TABLE "ScheduleBlock" ADD COLUMN "professionalId" TEXT;

CREATE INDEX "ScheduleBlock_professionalId_idx" ON "ScheduleBlock"("professionalId");

ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
