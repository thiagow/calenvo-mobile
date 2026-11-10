export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { payablePaymentSchema } from '@/lib/finance/schemas'
import { registerPayablePayment } from '@/lib/finance/receipts'

/** POST — baixa total ou parcial. MASTER. */
export const POST = financeRoute<{ id: string }>({ requireMaster: true }, 'payable_payment', async ({ scope, actorId }, request, { id }) => {
  const body = await parseBody(request, payablePaymentSchema)
  const { payable } = await inTransaction((tx) => registerPayablePayment(tx, { tenantId: scope.tenantId, payableId: id, actorId, ...body }))
  return json({ payable: { id: payable.id, status: payable.status, paidCents: payable.paidCents } })
})
