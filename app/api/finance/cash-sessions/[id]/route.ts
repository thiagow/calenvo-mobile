export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { cashSessionReport } from '@/lib/finance/cash'

/** GET — relatório de um caixa (aberto ou fechado). */
export const GET = financeRoute<{ id: string }>({ requireCashOperator: true }, 'cash_report', async ({ scope }, _req, { id }) =>
  json({ report: await inTransaction((tx) => cashSessionReport(tx, scope.tenantId, id)) })
)
