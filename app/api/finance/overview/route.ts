export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { financeOverview } from '@/lib/finance/reports'

/** GET /api/finance/overview — painel do Financeiro (MASTER). */
export const GET = financeRoute({ requireMaster: true }, 'overview', async ({ scope }) =>
  json(await inTransaction((tx) => financeOverview(tx, scope.tenantId)))
)
