export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { cashSessionReport } from '@/lib/finance/cash'
import { findOpenCashSession } from '@/lib/finance/context'

/** GET — caixa aberto agora, com a conferência em tempo real (ou null). */
export const GET = financeRoute({ requireCashOperator: true }, 'cash_current', async ({ scope }) => {
  const report = await inTransaction(async (tx) => {
    const session = await findOpenCashSession(tx, scope.tenantId)
    return session ? cashSessionReport(tx, scope.tenantId, session.id) : null
  })
  return json({ report })
})
