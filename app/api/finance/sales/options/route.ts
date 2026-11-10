export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { saleFormOptions } from '@/lib/finance/queries'

/** GET /api/finance/sales/options — serviços e equipe para montar a comanda. */
export const GET = financeRoute({ requireCashOperator: true }, 'sale_options', async ({ scope }) =>
  json(await inTransaction((tx) => saleFormOptions(tx, scope.tenantId)))
)
