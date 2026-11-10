export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { deleteCommissionRule } from '@/lib/finance/commissions'

/** DELETE — remove a regra. Comissões já geradas mantêm o snapshot. MASTER. */
export const DELETE = financeRoute<{ id: string }>({ requireMaster: true }, 'commission_rule_delete', async ({ scope }, _req, { id }) => {
  await inTransaction((tx) => deleteCommissionRule(tx, scope.tenantId, id))
  return json({ ok: true })
})
