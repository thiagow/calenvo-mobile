export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { stockAdjustSchema } from '@/lib/finance/schemas'
import { registerManualStock } from '@/lib/finance/stock'

/** POST /api/finance/products/[id]/stock — MASTER. Entrada por compra ou ajuste manual. */
export const POST = financeRoute<{ id: string }>({ requireMaster: true }, 'product_stock', async ({ scope, actorId }, request, { id }) => {
  const data = await parseBody(request, stockAdjustSchema)
  const movement = await inTransaction((tx) =>
    registerManualStock(tx, { tenantId: scope.tenantId, productId: id, actorId, kind: data.kind, quantity: data.quantity, note: data.note })
  )
  return json({ movement: { id: movement.id, balanceAfter: movement.balanceAfter } }, 201)
})
