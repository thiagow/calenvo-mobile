export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { receiptSchema } from '@/lib/finance/schemas'
import { registerReceipt } from '@/lib/finance/receipts'
import { receivableDetail } from '@/lib/finance/queries'

/** POST — recebe com uma ou mais formas de pagamento. Quem opera o caixa. */
export const POST = financeRoute<{ id: string }>({ requireCashOperator: true }, 'receipt', async ({ scope, actorId }, request, { id }) => {
  const { payments } = await parseBody(request, receiptSchema)
  const receivable = await inTransaction(async (tx) => {
    await registerReceipt(tx, { tenantId: scope.tenantId, receivableId: id, actorId, payments })
    return receivableDetail(tx, scope.tenantId, id)
  })
  return json({ receivable })
})
