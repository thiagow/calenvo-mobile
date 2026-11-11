export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { createProduct, listProducts } from '@/lib/finance/products'
import { productCreateSchema } from '@/lib/finance/schemas'

/**
 * GET /api/finance/products — quem opera o caixa precisa da lista para montar a
 * comanda. `?all=1` inclui inativos (só MASTER); `?q=` busca por nome ou SKU.
 */
export const GET = financeRoute({ requireCashOperator: true }, 'products_list', async ({ scope }, request) => {
  const params = request.nextUrl.searchParams
  const products = await inTransaction((tx) =>
    listProducts(tx, scope.tenantId, { includeInactive: scope.isMaster && params.get('all') === '1', q: params.get('q') })
  )
  return json({ products })
})

/** POST /api/finance/products — MASTER. */
export const POST = financeRoute({ requireMaster: true }, 'product_create', async ({ scope, actorId }, request) => {
  const data = await parseBody(request, productCreateSchema)
  const product = await inTransaction((tx) => createProduct(tx, { tenantId: scope.tenantId, actorId, data }))
  return json({ product }, 201)
})
