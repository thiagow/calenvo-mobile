import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import type { TenantScope } from '@/lib/reactivation-service'
import { getFinanceStatus, type FinanceStatus } from '@/lib/finance/status'

type GuardResult =
  | { scope: TenantScope; status: FinanceStatus; actorId: string; canOperateCash: boolean; error?: never }
  | { scope?: never; status?: never; actorId?: never; canOperateCash?: never; error: NextResponse }

interface RequireFinanceOptions {
  /** 403 para PROFESSIONAL. */
  requireMaster?: boolean
  /** 403 para quem não opera o caixa (MASTER sempre opera; PROFESSIONAL só com canOperateCash). */
  requireCashOperator?: boolean
  /** Permite a rota com o módulo desligado (só a tela de configuração/ativação). */
  allowInactive?: boolean
}

export const FINANCE_NOT_AVAILABLE = 'Módulo Financeiro não está disponível para esta conta'
export const FINANCE_INACTIVE = 'Módulo Financeiro está desativado'
export const CASH_OPERATOR_REQUIRED = 'Você não tem permissão para operar o caixa'

/**
 * Guard de toda rota /api/finance/*: auth → escopo do tenant → direito de uso
 * → módulo ligado → papel. Sem direito de uso responde 404 (o módulo "não
 * existe" para o tenant); desligado ou sem permissão, 403.
 */
export async function requireFinance({
  requireMaster = false,
  requireCashOperator = false,
  allowInactive = false
}: RequireFinanceOptions = {}): Promise<GuardResult> {
  const { scope, error } = await getSessionScope({ requireMaster })
  if (error) return { error }

  const status = await getFinanceStatus(scope.tenantId)
  if (!status.entitled) {
    return { error: NextResponse.json({ error: FINANCE_NOT_AVAILABLE }, { status: 404 }) }
  }
  if (!status.active && !allowInactive) {
    return { error: NextResponse.json({ error: FINANCE_INACTIVE }, { status: 403 }) }
  }

  const actorId = scope.professionalId ?? scope.tenantId
  let canOperateCash = scope.isMaster
  if (!canOperateCash && scope.professionalId) {
    const actor = await prisma.user.findUnique({ where: { id: scope.professionalId }, select: { canOperateCash: true } })
    canOperateCash = actor?.canOperateCash === true
  }
  if (requireCashOperator && !canOperateCash) {
    return { error: NextResponse.json({ error: CASH_OPERATOR_REQUIRED }, { status: 403 }) }
  }

  return { scope, status, actorId, canOperateCash }
}
