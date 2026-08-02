
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Backfill único: normaliza User.email (trim + lowercase) para todas as linhas
 * que ainda não estão normalizadas, mantendo consistência com o lookup
 * case-insensitive do login (lib/auth-options.ts) e com os pontos de escrita
 * que já normalizam email na criação/edição.
 *
 * Antes de aplicar cada update, verifica se a versão normalizada colidiria
 * com outra linha existente na constraint @@unique([email, role]) — nesse
 * caso, apenas reporta e NÃO aplica, para revisão manual.
 *
 * Uso: npx tsx scripts/normalize-user-emails.ts
 */
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true }
  })

  const normalized = (email: string) => email.trim().toLowerCase()

  const toUpdate = users.filter(u => u.email !== normalized(u.email))
  console.log(`Total de usuários: ${users.length}`)
  console.log(`Usuários com e-mail não normalizado: ${toUpdate.length}`)

  if (toUpdate.length === 0) {
    console.log('Nada a fazer.')
    return
  }

  const byNormalizedEmailAndRole = new Map<string, typeof users>()
  for (const u of users) {
    const key = `${normalized(u.email)}::${u.role}`
    const list = byNormalizedEmailAndRole.get(key) || []
    list.push(u)
    byNormalizedEmailAndRole.set(key, list)
  }

  let applied = 0
  let skipped = 0

  for (const user of toUpdate) {
    const target = normalized(user.email)
    const key = `${target}::${user.role}`
    const collisionGroup = byNormalizedEmailAndRole.get(key) || []
    const collidesWithOther = collisionGroup.some(u => u.id !== user.id)

    if (collidesWithOther) {
      console.warn(
        `⚠️  PULADO (colisão): id=${user.id} email="${user.email}" role=${user.role} ` +
        `-> "${target}" já usado por outra linha com o mesmo role. Revisar manualmente.`
      )
      skipped++
      continue
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { email: target }
    })
    console.log(`✅ Normalizado: id=${user.id} "${user.email}" -> "${target}"`)
    applied++
  }

  console.log(`\nConcluído. Atualizados: ${applied}. Pulados por colisão: ${skipped}.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Erro durante a normalização:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
