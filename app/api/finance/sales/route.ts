export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { manualSaleSchema } from '@/lib/finance/schemas'
import { createManualSale } from '@/lib/finance/sales'
import { saleDetail } from '@/lib/finance/queries'

/** POST /api/finance/sales — venda avulsa (balcão). Quem opera o caixa. */
export const POST = financeRoute({ requireCashOperator: true }, 'sale_create', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, manualSaleSchema)
  const sale = await inTransaction(async (tx) => {
    const created = await createManualSale(tx, { tenantId: scope.tenantId, actorId, ...body, clientId: body.clientId ?? null })
    return saleDetail(tx, scope.tenantId, created.id)
  })
  return json({ sale }, 201)
})
