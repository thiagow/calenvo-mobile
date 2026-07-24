
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Normalizando vínculos de "Eu mesmo atendo" em ScheduleProfessional...')

  const masterIds = new Set(
    (await prisma.user.findMany({ where: { role: 'MASTER' }, select: { id: true } })).map((u) => u.id)
  )

  const staleLinks = await prisma.scheduleProfessional.findMany({
    where: { professionalId: { in: Array.from(masterIds) } },
  })

  console.log(`📊 Encontrados ${staleLinks.length} vínculos apontando diretamente para um MASTER.`)

  let migrated = 0
  let deduped = 0
  let skipped = 0

  for (const link of staleLinks) {
    const clone = await prisma.user.findFirst({
      where: { masterId: link.professionalId, role: 'PROFESSIONAL' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    })

    if (!clone) {
      console.log(`⚠️  Master ${link.professionalId} não tem profissional-clone. Vínculo ${link.id} ignorado (revisar manualmente).`)
      skipped++
      continue
    }

    const existing = await prisma.scheduleProfessional.findUnique({
      where: { scheduleId_professionalId: { scheduleId: link.scheduleId, professionalId: clone.id } },
    })

    if (existing) {
      console.log(`🗑️  Agenda ${link.scheduleId} já tem vínculo com o clone ${clone.email} — removendo duplicata do MASTER.`)
      await prisma.scheduleProfessional.delete({ where: { id: link.id } })
      deduped++
      continue
    }

    console.log(`✨ Agenda ${link.scheduleId}: trocando vínculo do MASTER ${link.professionalId} pelo profissional-clone ${clone.id} (${clone.email})`)
    await prisma.scheduleProfessional.update({
      where: { id: link.id },
      data: { professionalId: clone.id },
    })
    migrated++
  }

  console.log(`🏁 Concluído! Migrados: ${migrated} | Deduplicados: ${deduped} | Ignorados: ${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
