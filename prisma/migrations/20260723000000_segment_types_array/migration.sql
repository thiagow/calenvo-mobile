-- Permitir múltiplos segmentos por conta: coluna escalar -> array

-- 1. Adicionar a nova coluna array (nullable por enquanto, para permitir backfill)
ALTER TABLE "User" ADD COLUMN "segmentTypes" "SegmentType"[];

-- 2. Backfill: cada conta existente passa a ter um array com o único segmento que já tinha
UPDATE "User" SET "segmentTypes" = ARRAY["segmentType"]::"SegmentType"[];

-- 3. Tornar a nova coluna obrigatória, com o mesmo default (como array) que a coluna antiga tinha
ALTER TABLE "User" ALTER COLUMN "segmentTypes" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "segmentTypes" SET DEFAULT ARRAY['BEAUTY_SALON']::"SegmentType"[];

-- 4. Remover a coluna antiga
ALTER TABLE "User" DROP COLUMN "segmentType";
