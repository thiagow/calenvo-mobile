export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { cashMovementSchema } from '@/lib/finance/schemas'
import { addCashMovement } from '@/lib/finance/cash'

/** POST — sangria ou suprimento no caixa aberto. */
export const POST = financeRoute({ requireCashOperator: true }, 'cash_movement', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, cashMovementSchema)
  const movement = await inTransaction((tx) => addCashMovement(tx, { tenantId: scope.tenantId, actorId, ...body }))
  return json({ movement: { id: movement.id } }, 201)
})
