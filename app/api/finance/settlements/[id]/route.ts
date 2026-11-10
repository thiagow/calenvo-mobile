export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { cancelSettlement, settlementReceipt } from '@/lib/finance/commissions'

type P = { id: string }

/** GET — comprovante. MASTER vê todos; o profissional vê só os próprios. */
export const GET = financeRoute<P>({}, 'settlement_get', async ({ scope }, _req, { id }) =>
  json({ settlement: await inTransaction((tx) => settlementReceipt(tx, scope.tenantId, id, scope.isMaster ? null : scope.professionalId)) })
)

/** DELETE — cancela o acerto (comissões voltam a pendentes e o pagamento é estornado). MASTER. */
export const DELETE = financeRoute<P>({ requireMaster: true }, 'settlement_cancel', async ({ scope, actorId }, _req, { id }) => {
  await inTransaction((tx) => cancelSettlement(tx, { tenantId: scope.tenantId, actorId, settlementId: id }))
  return json({ ok: true })
})
