export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { receivableDetail } from '@/lib/finance/queries'
import { cancelSaleRecord } from '@/lib/finance/sales'
import { conflict, notFound } from '@/lib/finance/errors'

type P = { id: string }

export const GET = financeRoute<P>({ requireCashOperator: true }, 'receivable_get', async ({ scope }, _req, { id }) =>
  json({ receivable: await inTransaction((tx) => receivableDetail(tx, scope.tenantId, id)) })
)

/** DELETE — cancela (sem pagamento). Conta de comanda cancela a comanda junto. MASTER. */
export const DELETE = financeRoute<P>({ requireMaster: true }, 'receivable_cancel', async ({ scope, actorId }, _req, { id }) => {
  await inTransaction(async (tx) => {
    const receivable = await tx.receivable.findFirst({ where: { id, userId: scope.tenantId } })
    if (!receivable) throw notFound('Conta a receber')
    if (receivable.paidCents > 0) throw conflict('Esta conta tem pagamento registrado. Estorne o pagamento antes.')
    if (receivable.saleId) {
      await cancelSaleRecord(tx, { tenantId: scope.tenantId, saleId: receivable.saleId, actorId, reason: 'conta cancelada' })
    } else {
      await tx.receivable.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
    }
  })
  return json({ ok: true })
})
