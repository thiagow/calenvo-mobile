export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { openCashSchema } from '@/lib/finance/schemas'
import { openCashSession } from '@/lib/finance/cash'
import { listCashSessions } from '@/lib/finance/queries'

/** GET — histórico de caixas. */
export const GET = financeRoute({ requireCashOperator: true }, 'cash_list', async ({ scope }) =>
  json({ sessions: await inTransaction((tx) => listCashSessions(tx, scope.tenantId)) })
)

/** POST — abre o caixa com o troco inicial. */
export const POST = financeRoute({ requireCashOperator: true }, 'cash_open', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, openCashSchema)
  const session = await inTransaction((tx) => openCashSession(tx, { tenantId: scope.tenantId, actorId, ...body }))
  return json({ session: { id: session.id } }, 201)
})
