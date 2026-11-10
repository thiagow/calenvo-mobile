export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { payableCancelSchema } from '@/lib/finance/schemas'
import { cancelPayable } from '@/lib/finance/payables'

/** POST — cancela a conta (ou ela e as próximas da série). MASTER. */
export const POST = financeRoute<{ id: string }>({ requireMaster: true }, 'payable_cancel', async ({ scope }, request, { id }) => {
  const { includeFollowing } = await parseBody(request, payableCancelSchema)
  return json(await inTransaction((tx) => cancelPayable(tx, { tenantId: scope.tenantId, payableId: id, includeFollowing })))
})
