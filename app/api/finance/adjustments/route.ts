export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { adjustmentCreateSchema } from '@/lib/finance/schemas'
import { createAdjustment } from '@/lib/finance/commissions'

/** POST — vale (sai dinheiro agora), bônus ou desconto, abatidos no próximo acerto. MASTER. */
export const POST = financeRoute({ requireMaster: true }, 'adjustment_create', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, adjustmentCreateSchema)
  const adjustment = await inTransaction((tx) => createAdjustment(tx, { tenantId: scope.tenantId, actorId, ...body }))
  return json({ adjustment: { id: adjustment.id } }, 201)
})
