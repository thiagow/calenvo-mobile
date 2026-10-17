-- Intervalo entre horários oferecidos (0 = igual à duração do serviço) e agendamento inteligente.
-- Colunas com DEFAULT: linhas existentes passam a oferecer horários a cada 30 min, com a regra inteligente ligada.
ALTER TABLE "Schedule" ADD COLUMN "startInterval" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Schedule" ADD COLUMN "smartScheduling" BOOLEAN NOT NULL DEFAULT true;
