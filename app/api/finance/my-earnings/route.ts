export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { previewSettlement } from '@/lib/finance/commissions'
import { listSettlements } from '@/lib/finance/queries'
import { badRequest } from '@/lib/finance/errors'

/** GET — "Meus ganhos": comissões a receber, vales e acertos do próprio profissional. */
export const GET = financeRoute({}, 'my_earnings', async ({ scope }) => {
  if (!scope.professionalId) throw badRequest('Disponível para profissionais da equipe')
  const professionalId = scope.professionalId
  const data = await inTransaction(async (tx) => {
    const [preview, settlements, currency] = await Promise.all([
      previewSettlement(tx, { tenantId: scope.tenantId, professionalId }),
      listSettlements(tx, scope.tenantId, professionalId),
      tx.user.findUnique({ where: { id: scope.tenantId }, select: { currency: true } })
    ])
    return { ...preview, settlements, currency: currency?.currency ?? 'BRL' }
  })
  return json(data)
})
