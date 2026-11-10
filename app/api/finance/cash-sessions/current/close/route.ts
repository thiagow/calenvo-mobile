export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { closeCashSchema } from '@/lib/finance/schemas'
import { cashSessionReport, closeCashSession } from '@/lib/finance/cash'

/** POST — fecha o caixa com o valor contado na gaveta; grava a diferença. */
export const POST = financeRoute({ requireCashOperator: true }, 'cash_close', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, closeCashSchema)
  const report = await inTransaction(async (tx) => {
    const session = await closeCashSession(tx, { tenantId: scope.tenantId, actorId, ...body })
    return cashSessionReport(tx, scope.tenantId, session.id)
  })
  return json({ report })
})
