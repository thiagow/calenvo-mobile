import { prisma } from '@/lib/db'

/**
 * Resolve o tenant (User MASTER) dono de uma URL pública, por ID (prefixo) ou
 * pelo slug customizado salvo em BusinessConfig.publicUrl. Mesma resolução
 * usada pela página de booking público e pelo widget de chat.
 */
export async function resolveTenantBySlug(slug: string) {
  let user = await prisma.user.findFirst({
    where: { id: { startsWith: slug } },
    include: { businessConfig: true },
  })

  if (!user) {
    const businessConfig = await prisma.businessConfig.findFirst({
      where: { publicUrl: slug },
      include: { user: true },
    })

    if (businessConfig) {
      user = await prisma.user.findUnique({
        where: { id: businessConfig.userId },
        include: { businessConfig: true },
      })
    }
  }

  return user
}

/**
 * Garante um slug único para o link público de agendamento — `publicUrl` tem
 * `@unique` no schema, mas nada verificava isso antes de tentar salvar, então
 * duas empresas com nomes iguais (ex.: "Clínica Teste") colidiam e o `upsert`
 * só falharia na hora H com um 500 genérico. Se `baseSlug` já pertence a OUTRA
 * conta, tenta "baseSlug-2", "baseSlug-3"... até achar um livre.
 */
export async function resolveUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  if (!baseSlug) return baseSlug

  let candidate = baseSlug
  let suffix = 2

  while (true) {
    const existing = await prisma.businessConfig.findFirst({
      where: { publicUrl: candidate, NOT: { userId } },
      select: { userId: true },
    })

    if (!existing) return candidate

    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
}
