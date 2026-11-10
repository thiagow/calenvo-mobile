export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { cancelAdjustment } from '@/lib/finance/commissions'

/** DELETE — cancela vale/bônus/desconto ainda não acertado. Vale pago volta para o caixa. MASTER. */
export const DELETE = financeRoute<{ id: string }>({ requireMaster: true }, 'adjustment_cancel', async ({ scope, actorId }, _req, { id }) => {
  await inTransaction((tx) => cancelAdjustment(tx, { tenantId: scope.tenantId, actorId, adjustmentId: id }))
  return json({ ok: true })
})
