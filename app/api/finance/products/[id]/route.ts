export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { removeProduct, updateProduct } from '@/lib/finance/products'
import { productUpdateSchema } from '@/lib/finance/schemas'

/** PUT /api/finance/products/[id] — MASTER. */
export const PUT = financeRoute<{ id: string }>({ requireMaster: true }, 'product_update', async ({ scope }, request, { id }) => {
  const data = await parseBody(request, productUpdateSchema)
  const product = await inTransaction((tx) => updateProduct(tx, { tenantId: scope.tenantId, productId: id, data }))
  return json({ product })
})

/** DELETE /api/finance/products/[id] — MASTER. Com venda no histórico, desativa em vez de apagar. */
export const DELETE = financeRoute<{ id: string }>({ requireMaster: true }, 'product_delete', async ({ scope }, _request, { id }) =>
  json(await inTransaction((tx) => removeProduct(tx, { tenantId: scope.tenantId, productId: id })))
)
