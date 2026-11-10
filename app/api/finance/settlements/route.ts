export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { settlementCreateSchema } from '@/lib/finance/schemas'
import { createSettlement } from '@/lib/finance/commissions'
import { listSettlements } from '@/lib/finance/queries'

/** GET ?professionalId= — histórico de acertos. MASTER. */
export const GET = financeRoute({ requireMaster: true }, 'settlements_list', async ({ scope }, request) =>
  json({ settlements: await inTransaction((tx) => listSettlements(tx, scope.tenantId, request.nextUrl.searchParams.get('professionalId'))) })
)

/** POST — confirma e paga o acerto. MASTER. */
export const POST = financeRoute({ requireMaster: true }, 'settlement_create', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, settlementCreateSchema)
  const settlement = await inTransaction((tx) => createSettlement(tx, { tenantId: scope.tenantId, actorId, ...body }))
  return json({ settlement: { id: settlement.id } }, 201)
})
