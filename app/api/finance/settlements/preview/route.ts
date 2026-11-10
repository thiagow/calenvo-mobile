export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { previewSettlement } from '@/lib/finance/commissions'
import { badRequest } from '@/lib/finance/errors'
import { parseDateParam } from '@/lib/finance/http'

/** GET ?professionalId=&until= — o que entra no acerto agora. MASTER. */
export const GET = financeRoute({ requireMaster: true }, 'settlement_preview', async ({ scope }, request) => {
  const professionalId = request.nextUrl.searchParams.get('professionalId')
  if (!professionalId) throw badRequest('Informe o profissional')
  const until = parseDateParam(request.nextUrl.searchParams.get('until'))
  return json(await inTransaction((tx) => previewSettlement(tx, { tenantId: scope.tenantId, professionalId, until })))
})
