import type { FeatureKey, FeatureStatus, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * Direito de uso de módulos opcionais por tenant (TenantFeature).
 * Ter o direito não liga o módulo — cada módulo tem a própria chave
 * (ex.: FinanceConfig.isActive). Esta camada só responde "pode usar?".
 */

type Db = PrismaClient | Prisma.TransactionClient

export interface EntitlementLike {
  status: FeatureStatus
  expiresAt: Date | null
}

export function isEntitlementActive(entitlement: EntitlementLike | null | undefined, now: Date = new Date()): boolean {
  if (!entitlement || entitlement.status !== 'ACTIVE') return false
  return !entitlement.expiresAt || entitlement.expiresAt.getTime() > now.getTime()
}

export async function hasFeature(tenantId: string, feature: FeatureKey, db: Db = prisma): Promise<boolean> {
  const entitlement = await db.tenantFeature.findUnique({
    where: { userId_feature: { userId: tenantId, feature } },
    select: { status: true, expiresAt: true }
  })
  return isEntitlementActive(entitlement)
}
