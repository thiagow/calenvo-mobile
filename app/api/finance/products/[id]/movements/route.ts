export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { listStockMovements } from '@/lib/finance/products'

/** GET /api/finance/products/[id]/movements — MASTER. Histórico de estoque do produto. */
export const GET = financeRoute<{ id: string }>({ requireMaster: true }, 'product_movements', async ({ scope }, _request, { id }) =>
  json({ movements: await inTransaction((tx) => listStockMovements(tx, scope.tenantId, id)) })
)
