import type { FinanceConfig, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isEntitlementActive } from '@/lib/features'

type Db = PrismaClient | Prisma.TransactionClient

export interface FinanceStatus {
  /** Tenant tem direito de uso (add-on, liberação do admin ou plano). */
  entitled: boolean
  /** Direito de uso + chave ligada pelo MASTER. Só aqui o módulo age. */
  active: boolean
  config: FinanceConfig | null
}

export function resolveFinanceStatus(
  entitlement: Parameters<typeof isEntitlementActive>[0],
  config: FinanceConfig | null,
  now: Date = new Date()
): FinanceStatus {
  const entitled = isEntitlementActive(entitlement, now)
  return { entitled, active: entitled && config?.isActive === true, config }
}

/** Uma ida ao banco: direito de uso e configuração juntos. */
export async function getFinanceStatus(tenantId: string, db: Db = prisma): Promise<FinanceStatus> {
  const [entitlement, config] = await Promise.all([
    db.tenantFeature.findUnique({
      where: { userId_feature: { userId: tenantId, feature: 'FINANCE' } },
      select: { status: true, expiresAt: true }
    }),
    db.financeConfig.findUnique({ where: { userId: tenantId } })
  ])
  return resolveFinanceStatus(entitlement, config)
}

/** Usado pelos ganchos do núcleo: o módulo desligado nunca age. */
export async function isFinanceEnabled(tenantId: string, db: Db = prisma): Promise<boolean> {
  return (await getFinanceStatus(tenantId, db)).active
}
