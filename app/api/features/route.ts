export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { getFinanceStatus } from '@/lib/finance/status'
import { financeAddonPriceFor } from '@/lib/finance/addon'

/**
 * Módulos opcionais visíveis para a sessão (menu e telas condicionais).
 * Só informa disponibilidade — cada rota do módulo revalida no servidor.
 */
export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const finance = await getFinanceStatus(scope.tenantId)
    let canOperateCash = scope.isMaster
    let currency: string = 'BRL'
    if (finance.active) {
      const [owner, actor] = await Promise.all([
        prisma.user.findUnique({ where: { id: scope.tenantId }, select: { currency: true } }),
        scope.professionalId
          ? prisma.user.findUnique({ where: { id: scope.professionalId }, select: { canOperateCash: true } })
          : null
      ])
      currency = owner?.currency ?? 'BRL'
      canOperateCash = scope.isMaster || actor?.canOperateCash === true
    }

    // Contratar pelo app: só o dono, sem direito de uso ainda, com assinatura e add-on configurado.
    let addonAvailable = false
    if (scope.isMaster && !finance.entitled) {
      const owner = await prisma.user.findUnique({ where: { id: scope.tenantId }, select: { subscriptionId: true, currency: true } })
      addonAvailable = Boolean(owner?.subscriptionId && financeAddonPriceFor(owner.currency))
    }

    return NextResponse.json({
      finance: {
        addonAvailable,
        entitled: finance.entitled,
        active: finance.active,
        canOperateCash: finance.active && canOperateCash,
        isMaster: scope.isMaster,
        currency
      }
    })
  } catch (error) {
    console.error('[features] status failed:', error)
    return NextResponse.json({ error: 'Erro ao carregar módulos' }, { status: 500 })
  }
}
