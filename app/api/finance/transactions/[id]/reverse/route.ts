export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { reverseSchema } from '@/lib/finance/schemas'
import { reverseTransaction } from '@/lib/finance/receipts'

/** POST — estorna um lançamento (cria o lançamento oposto; nada é apagado). MASTER. */
export const POST = financeRoute<{ id: string }>({ requireMaster: true }, 'reverse', async ({ scope, actorId }, request, { id }) => {
  const { reason } = await parseBody(request, reverseSchema)
  const reversal = await inTransaction((tx) => reverseTransaction(tx, { tenantId: scope.tenantId, transactionId: id, actorId, reason }))
  return json({ reversal: { id: reversal.id } }, 201)
})
