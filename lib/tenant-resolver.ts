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
