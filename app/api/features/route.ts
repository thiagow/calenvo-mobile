export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionScope } from '@/lib/session-scope'
import { getFinanceStatus } from '@/lib/finance/status'

/**
 * Módulos opcionais visíveis para a sessão (menu e telas condicionais).
 * Só informa disponibilidade — cada rota do módulo revalida no servidor.
 */
export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const finance = await getFinanceStatus(scope.tenantId)
    return NextResponse.json({
      finance: { entitled: finance.entitled, active: finance.active }
    })
  } catch (error) {
    console.error('[features] status failed:', error)
    return NextResponse.json({ error: 'Erro ao carregar módulos' }, { status: 500 })
  }
}
