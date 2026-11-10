export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { logError } from '@/lib/error-logger'
import { financeAddonPriceFor, financeAddonPriceIds, findAddonItem, syncFinanceAddon } from '@/lib/finance/addon'

/**
 * Contratar / cancelar o add-on do Financeiro na assinatura atual (MASTER).
 * Não exige direito de uso — é justamente como ele é obtido. O webhook do
 * Stripe também sincroniza; aqui sincronizamos já na resposta para a UI.
 */

async function loadContext() {
  const { scope, error } = await getSessionScope({ requireMaster: true })
  if (error) return { error }
  const owner = await prisma.user.findUnique({
    where: { id: scope.tenantId },
    select: { subscriptionId: true, currency: true, isPaymentExempt: true }
  })
  if (!owner?.subscriptionId) {
    return { error: NextResponse.json({ error: 'Sua conta não tem assinatura ativa. Fale com o suporte para liberar o Financeiro.' }, { status: 409 }) }
  }
  const priceId = financeAddonPriceFor(owner.currency)
  if (!priceId) return { error: NextResponse.json({ error: 'Add-on do Financeiro indisponível no momento' }, { status: 503 }) }
  const { stripe } = await import('@/lib/stripe')
  return { scope, owner: { ...owner, subscriptionId: owner.subscriptionId }, priceId, stripe }
}

export async function POST() {
  const ctx = await loadContext()
  if ('error' in ctx) return ctx.error
  try {
    const subscription = await ctx.stripe.subscriptions.retrieve(ctx.owner.subscriptionId)
    if (!findAddonItem(subscription.items.data, financeAddonPriceIds())) {
      await ctx.stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: ctx.priceId,
        quantity: 1,
        proration_behavior: 'create_prorations'
      })
    }
    const updated = await ctx.stripe.subscriptions.retrieve(subscription.id)
    const outcome = await syncFinanceAddon(prisma, { tenantId: ctx.scope.tenantId, subscriptionStatus: updated.status, items: updated.items.data })
    return NextResponse.json({ outcome })
  } catch (error) {
    console.error('[finance] addon subscribe failed:', error)
    await logError({ functionality: 'finance_addon_subscribe', error, userId: ctx.scope.tenantId })
    return NextResponse.json({ error: 'Não foi possível contratar o add-on agora' }, { status: 502 })
  }
}

export async function DELETE() {
  const ctx = await loadContext()
  if ('error' in ctx) return ctx.error
  try {
    const subscription = await ctx.stripe.subscriptions.retrieve(ctx.owner.subscriptionId)
    const item = findAddonItem(subscription.items.data, financeAddonPriceIds())
    if (item) await ctx.stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' })
    const updated = await ctx.stripe.subscriptions.retrieve(subscription.id)
    const outcome = await syncFinanceAddon(prisma, { tenantId: ctx.scope.tenantId, subscriptionStatus: updated.status, items: updated.items.data })
    return NextResponse.json({ outcome })
  } catch (error) {
    console.error('[finance] addon cancel failed:', error)
    await logError({ functionality: 'finance_addon_cancel', error, userId: ctx.scope.tenantId })
    return NextResponse.json({ error: 'Não foi possível cancelar o add-on agora' }, { status: 502 })
  }
}
