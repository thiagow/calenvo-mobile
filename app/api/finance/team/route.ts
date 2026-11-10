export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { teamOverview } from '@/lib/finance/queries'

/** GET — equipe com regras de comissão, pendências e vales em aberto. MASTER. */
export const GET = financeRoute({ requireMaster: true }, 'team', async ({ scope }) =>
  json(await inTransaction((tx) => teamOverview(tx, scope.tenantId)))
)
