-- Remover colunas específicas de templates
ALTER TABLE "User" DROP COLUMN IF EXISTS "specialty";
ALTER TABLE "User" DROP COLUMN IF EXISTS "serviceType";

-- Remover colunas específicas de clientes
ALTER TABLE "Client" DROP COLUMN IF EXISTS "insurance";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "skinType";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "hairType";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "allergies";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "preferences";

-- Alterar o tipo do enum com mapeamento correto
ALTER TYPE "SegmentType" RENAME TO "SegmentType_old";
CREATE TYPE "SegmentType" AS ENUM ('BEAUTY_SALON', 'BARBERSHOP', 'AESTHETIC_CLINIC', 'TECH_SAAS', 'PROFESSIONAL_SERVICES', 'HR', 'PHYSIOTHERAPY', 'EDUCATION', 'PET_SHOP', 'OTHER');

-- Converter os valores antigos para os novos com tratamento adequado
ALTER TABLE "User" 
  ALTER COLUMN "segmentType" TYPE "SegmentType" 
  USING (
    CASE "segmentType"::text
      WHEN 'MEDICAL_CLINIC' THEN 'BEAUTY_SALON'::SegmentType
      WHEN 'MAINTENANCE_SERVICE' THEN 'OTHER'::SegmentType
      WHEN 'VETERINARY_CLINIC' THEN 'PET_SHOP'::SegmentType
      ELSE "segmentType"::text::SegmentType
    END
  );
  
ALTER TABLE "User" ALTER COLUMN "segmentType" SET DEFAULT 'BEAUTY_SALON';
DROP TYPE "SegmentType_old";
