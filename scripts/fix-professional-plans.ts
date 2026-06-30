
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Corrigindo planos de profissionais...')

  // Buscar todos os profissionais que têm um masterId
  const professionals = await prisma.user.findMany({
    where: {
      role: 'PROFESSIONAL',
      masterId: { not: null }
    },
    include: {
      master: {
        select: {
          planType: true
        }
      }
    }
  })

  console.log(`📊 Encontrados ${professionals.length} profissionais para processar.`)

  for (const professional of professionals) {
    if (professional.master && professional.planType !== professional.master.planType) {
      console.log(`✨ Atualizando profissional ${professional.email}: ${professional.planType} -> ${professional.master.planType}`)
      
      await prisma.user.update({
        where: { id: professional.id },
        data: {
          planType: professional.master.planType
        }
      })
    } else {
      console.log(`✅ Profissional ${professional.email} já está com o plano correto ou não tem master.`)
    }
  }

  console.log('🏁 Concluído!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
