export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { saleUpdateSchema } from '@/lib/finance/schemas'
import { cancelSaleRecord, updateSaleItems } from '@/lib/finance/sales'
import { saleDetail } from '@/lib/finance/queries'

type P = { id: string }

/** GET /api/finance/sales/[id] — comanda com itens, comissões e pagamentos. */
export const GET = financeRoute<P>({ requireCashOperator: true }, 'sale_get', async ({ scope }, _req, { id }) =>
  json({ sale: await inTransaction((tx) => saleDetail(tx, scope.tenantId, id)) })
)

/** PUT /api/finance/sales/[id] — "Fechar comanda": serviços executados, profissionais e desconto. */
export const PUT = financeRoute<P>({ requireCashOperator: true }, 'sale_update', async ({ scope, actorId }, request, { id }) => {
  const body = await parseBody(request, saleUpdateSchema)
  const sale = await inTransaction(async (tx) => {
    const updated = await updateSaleItems(tx, { tenantId: scope.tenantId, saleId: id, actorId, ...body })
    return saleDetail(tx, scope.tenantId, updated.id)
  })
  return json({ sale })
})

/** DELETE /api/finance/sales/[id] — cancela a comanda (sem pagamento). MASTER. */
export const DELETE = financeRoute<P>({ requireMaster: true }, 'sale_cancel', async ({ scope, actorId }, _req, { id }) => {
  await inTransaction((tx) => cancelSaleRecord(tx, { tenantId: scope.tenantId, saleId: id, actorId, reason: 'comanda cancelada' }))
  return json({ ok: true })
})
