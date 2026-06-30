
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Executando migração de segmentos...')
  
  try {
    // Step 1: Add new columns temporarily
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "segmentType_new" TEXT')
    console.log('✅ Coluna temporária criada')
    
    // Step 2: Map old values to new ones
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET "segmentType_new" = 'BEAUTY_SALON' 
      WHERE "segmentType" IN ('MEDICAL_CLINIC', 'MAINTENANCE_SERVICE', 'VETERINARY_CLINIC', 'BEAUTY_SALON')
    `)
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "segmentType_new" = 'EDUCATION' WHERE "segmentType" = 'EDUCATION'`)
    console.log('✅ Valores mapeados')
    
    // Step 3: Drop old columns
    await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN IF EXISTS "specialty"')
    await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN IF EXISTS "serviceType"')
    await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "segmentType"')
    console.log('✅ Colunas antigas removidas')
    
    // Step 4: Drop old enum and create new one
    await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "SegmentType"')
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "SegmentType" AS ENUM (
        'BEAUTY_SALON', 'BARBERSHOP', 'AESTHETIC_CLINIC', 'TECH_SAAS', 
        'PROFESSIONAL_SERVICES', 'HR', 'PHYSIOTHERAPY', 'EDUCATION', 'PET_SHOP', 'OTHER'
      )
    `)
    console.log('✅ Novo enum criado')
    
    // Step 5: Create new column with proper type
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "segmentType" "SegmentType" DEFAULT \'BEAUTY_SALON\'')
    await prisma.$executeRawUnsafe('UPDATE "User" SET "segmentType" = "segmentType_new"::"SegmentType"')
    await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "segmentType_new"')
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ALTER COLUMN "segmentType" SET NOT NULL')
    console.log('✅ Nova coluna configurada')
    
    // Step 6: Clean up Client table
    await prisma.$executeRawUnsafe('ALTER TABLE "Client" DROP COLUMN IF EXISTS "insurance"')
    await prisma.$executeRawUnsafe('ALTER TABLE "Client" DROP COLUMN IF EXISTS "skinType"')
    await prisma.$executeRawUnsafe('ALTER TABLE "Client" DROP COLUMN IF EXISTS "hairType"')
    await prisma.$executeRawUnsafe('ALTER TABLE "Client" DROP COLUMN IF EXISTS "allergies"')
    await prisma.$executeRawUnsafe('ALTER TABLE "Client" DROP COLUMN IF EXISTS "preferences"')
    console.log('✅ Tabela Client limpa')
    
    console.log('✅ Migração concluída com sucesso!')
  } catch (error) {
    console.error('❌ Erro na migração:', error)
    throw error
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
