import { NextResponse } from 'next/server'
import { getSessionScope } from '@/lib/session-scope'
import type { TenantScope } from '@/lib/reactivation-service'
import { getFinanceStatus, type FinanceStatus } from '@/lib/finance/status'

type GuardResult =
  | { scope: TenantScope; status: FinanceStatus; error?: never }
  | { scope?: never; status?: never; error: NextResponse }

interface RequireFinanceOptions {
  /** 403 para PROFESSIONAL. */
  requireMaster?: boolean
  /** Permite a rota com o módulo desligado (só a tela de configuração/ativação). */
  allowInactive?: boolean
}

export const FINANCE_NOT_AVAILABLE = 'Módulo Financeiro não está disponível para esta conta'
export const FINANCE_INACTIVE = 'Módulo Financeiro está desativado'

/**
 * Guard de toda rota /api/finance/*: auth → escopo do tenant → direito de uso
 * → módulo ligado → papel. Sem direito de uso responde 404 (o módulo "não
 * existe" para o tenant); desligado ou sem permissão, 403.
 */
export async function requireFinance({ requireMaster = false, allowInactive = false }: RequireFinanceOptions = {}): Promise<GuardResult> {
  const { scope, error } = await getSessionScope({ requireMaster })
  if (error) return { error }

  const status = await getFinanceStatus(scope.tenantId)
  if (!status.entitled) {
    return { error: NextResponse.json({ error: FINANCE_NOT_AVAILABLE }, { status: 404 }) }
  }
  if (!status.active && !allowInactive) {
    return { error: NextResponse.json({ error: FINANCE_INACTIVE }, { status: 403 }) }
  }
  return { scope, status }
}
