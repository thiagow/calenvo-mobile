export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireFinance } from '@/lib/finance/guard'
import { ensureFinanceDefaults } from '@/lib/finance/defaults'
import { financeConfigUpdateSchema, zodMessage } from '@/lib/finance/schemas'
import { financeErrorResponse, readJson } from '@/lib/finance/http'

const DEFAULT_CONFIG = {
  isActive: false,
  activatedAt: null,
  commissionBase: 'AFTER_DISCOUNT',
  requireOpenCashSession: true,
  settleOnlyPaidCommissions: true
} as const

function serialize(config: {
  isActive: boolean
  activatedAt: Date | null
  commissionBase: string
  requireOpenCashSession: boolean
  settleOnlyPaidCommissions: boolean
}) {
  return {
    isActive: config.isActive,
    activatedAt: config.activatedAt,
    commissionBase: config.commissionBase,
    requireOpenCashSession: config.requireOpenCashSession,
    settleOnlyPaidCommissions: config.settleOnlyPaidCommissions
  }
}

/** GET /api/finance/config — MASTER; funciona com o módulo desligado (tela de ativação). */
export async function GET() {
  const guard = await requireFinance({ requireMaster: true, allowInactive: true })
  if (guard.error) return guard.error
  const owner = await prisma.user.findUnique({ where: { id: guard.scope.tenantId }, select: { currency: true } })
  return NextResponse.json({
    config: serialize(guard.status.config ?? DEFAULT_CONFIG),
    currency: owner?.currency ?? 'BRL'
  })
}

/**
 * PUT /api/finance/config — liga/desliga e ajusta regras. Na primeira
 * ativação cria formas de pagamento e categorias padrão e grava `activatedAt`
 * (corte da tela de pendências). Desligar não apaga nada.
 */
export async function PUT(request: NextRequest) {
  const guard = await requireFinance({ requireMaster: true, allowInactive: true })
  if (guard.error) return guard.error
  const { tenantId } = guard.scope

  const parsed = financeConfigUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })
  const changes = parsed.data

  try {
    const config = await prisma.$transaction(async (tx) => {
      const current = await tx.financeConfig.findUnique({ where: { userId: tenantId } })
      const activating = changes.isActive === true && !current?.isActive

      if (activating) {
        const owner = await tx.user.findUnique({ where: { id: tenantId }, select: { locale: true } })
        await ensureFinanceDefaults(tx, tenantId, owner?.locale)
      }

      const activatedAt = activating && !current?.activatedAt ? new Date() : undefined
      return tx.financeConfig.upsert({
        where: { userId: tenantId },
        update: { ...changes, ...(activatedAt && { activatedAt }) },
        create: { userId: tenantId, ...changes, ...(activatedAt && { activatedAt }) }
      })
    })

    return NextResponse.json({ config: serialize(config) })
  } catch (error) {
    return financeErrorResponse(error, 'config_update', tenantId)
  }
}
