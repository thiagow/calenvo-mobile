export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { payableCreateSchema } from '@/lib/finance/schemas'
import { createPayables } from '@/lib/finance/payables'
import { listPayables, type EntryFilter } from '@/lib/finance/queries'
import { loadTimezone } from '@/lib/finance/context'
import { tenantCalendarDayWindow, todayInZone } from '@/lib/timezone'

const FILTERS: EntryFilter[] = ['open', 'overdue', 'paid', 'all']

/** GET /api/finance/payables?status= — MASTER. */
export const GET = financeRoute({ requireMaster: true }, 'payables_list', async ({ scope }, request) => {
  const status = request.nextUrl.searchParams.get('status') ?? ''
  const filter = (FILTERS as string[]).includes(status) ? (status as EntryFilter) : 'open'
  const payables = await inTransaction(async (tx) => {
    const tz = await loadTimezone(tx, scope.tenantId)
    const { start } = tenantCalendarDayWindow(tz, todayInZone(tz))
    return listPayables(tx, scope.tenantId, filter, start)
  })
  return json({ payables })
})

/** POST — conta avulsa, parcelada ou recorrente (série gerada de antemão). MASTER. */
export const POST = financeRoute({ requireMaster: true }, 'payable_create', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, payableCreateSchema)
  const result = await inTransaction((tx) => createPayables(tx, { tenantId: scope.tenantId, actorId, ...body }))
  return json(result, 201)
})
