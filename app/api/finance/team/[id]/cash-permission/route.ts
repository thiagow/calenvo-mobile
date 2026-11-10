export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { professionalCashPermissionSchema } from '@/lib/finance/schemas'
import { notFound } from '@/lib/finance/errors'

/** PATCH — libera/revoga a operação do caixa para um profissional. MASTER. */
export const PATCH = financeRoute<{ id: string }>({ requireMaster: true }, 'cash_permission', async ({ scope }, request, { id }) => {
  const { canOperateCash } = await parseBody(request, professionalCashPermissionSchema)
  const { count } = await inTransaction((tx) =>
    tx.user.updateMany({ where: { id, masterId: scope.tenantId, role: 'PROFESSIONAL' }, data: { canOperateCash } })
  )
  if (count === 0) throw notFound('Profissional')
  return json({ canOperateCash })
})
