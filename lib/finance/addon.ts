import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Add-on do Módulo Financeiro na assinatura Stripe. Sem dependência de
 * `lib/stripe` (que exige STRIPE_SECRET_KEY no import): recebe os dados da
 * assinatura já carregados, para ser usado pelo webhook e testado isolado.
 */

type Db = PrismaClient | Prisma.TransactionClient

export function financeAddonPriceIds(env: Record<string, string | undefined> = process.env): string[] {
  return [env.STRIPE_FINANCE_ADDON_PRICE_ID, env.STRIPE_FINANCE_ADDON_PRICE_ID_USD].filter((v): v is string => Boolean(v))
}

export function financeAddonPriceFor(currency: 'BRL' | 'USD', env: Record<string, string | undefined> = process.env): string | null {
  return (currency === 'USD' ? env.STRIPE_FINANCE_ADDON_PRICE_ID_USD : env.STRIPE_FINANCE_ADDON_PRICE_ID) || null
}

export interface SubscriptionItemLike {
  id: string
  price: { id: string } | null
}

/** Item do add-on na assinatura (ou null). */
export function findAddonItem(items: SubscriptionItemLike[], addonPriceIds: string[]): SubscriptionItemLike | null {
  return items.find((i) => i.price && addonPriceIds.includes(i.price.id)) ?? null
}

/**
 * Price do PLANO na assinatura. Com o add-on como segundo item, `items[0]`
 * deixa de ser garantidamente o plano — escolhe o primeiro item que mapeia.
 */
export function pickPlanPriceId(items: SubscriptionItemLike[], isPlanPrice: (priceId: string) => boolean): string | null {
  return items.find((i) => i.price && isPlanPrice(i.price.id))?.price?.id ?? items[0]?.price?.id ?? null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * Reflete o add-on no TenantFeature. Só mexe em direito de uso de origem
 * ADDON: uma liberação do admin (GRANT) nunca é revogada por um evento do Stripe.
 */
export async function syncFinanceAddon(
  db: Db,
  params: { tenantId: string; subscriptionStatus: string; items: SubscriptionItemLike[]; addonPriceIds?: string[] }
) {
  const addonPriceIds = params.addonPriceIds ?? financeAddonPriceIds()
  if (addonPriceIds.length === 0) return 'not_configured' as const

  const item = findAddonItem(params.items, addonPriceIds)
  const current = await db.tenantFeature.findUnique({
    where: { userId_feature: { userId: params.tenantId, feature: 'FINANCE' } }
  })

  if (item && ACTIVE_STATUSES.has(params.subscriptionStatus)) {
    if (current?.source === 'GRANT' && current.status === 'ACTIVE') return 'kept_grant' as const
    await db.tenantFeature.upsert({
      where: { userId_feature: { userId: params.tenantId, feature: 'FINANCE' } },
      update: { status: 'ACTIVE', source: 'ADDON', stripeSubscriptionItemId: item.id, expiresAt: null },
      create: { userId: params.tenantId, feature: 'FINANCE', source: 'ADDON', status: 'ACTIVE', stripeSubscriptionItemId: item.id }
    })
    return 'activated' as const
  }

  if (current?.source === 'ADDON' && current.status === 'ACTIVE') {
    await db.tenantFeature.update({ where: { id: current.id }, data: { status: 'CANCELED' } })
    return 'canceled' as const
  }
  return 'unchanged' as const
}
