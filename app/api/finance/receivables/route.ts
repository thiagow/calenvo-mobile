export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { manualReceivableSchema } from '@/lib/finance/schemas'
import { listReceivables, type EntryFilter } from '@/lib/finance/queries'
import { assertCategory, loadTimezone } from '@/lib/finance/context'
import { badRequest } from '@/lib/finance/errors'
import { tenantCalendarDayWindow, todayInZone } from '@/lib/timezone'

const FILTERS: EntryFilter[] = ['open', 'overdue', 'paid', 'all']

/** GET /api/finance/receivables?status=open|overdue|paid|all&q= */
export const GET = financeRoute({ requireCashOperator: true }, 'receivables_list', async ({ scope }, request) => {
  const params = request.nextUrl.searchParams
  const filter = (FILTERS as string[]).includes(params.get('status') ?? '') ? (params.get('status') as EntryFilter) : 'open'
  const receivables = await inTransaction(async (tx) => {
    const tz = await loadTimezone(tx, scope.tenantId)
    const { start } = tenantCalendarDayWindow(tz, todayInZone(tz))
    return listReceivables(tx, scope.tenantId, filter, start, params.get('q')?.trim().slice(0, 80) || null)
  })
  return json({ receivables })
})

/** POST /api/finance/receivables — lançamento manual (sem comanda). MASTER. */
export const POST = financeRoute({ requireMaster: true }, 'receivable_create', async ({ scope, actorId }, request) => {
  const body = await parseBody(request, manualReceivableSchema)
  const receivable = await inTransaction(async (tx) => {
    await assertCategory(tx, scope.tenantId, body.categoryId, 'INCOME')
    if (body.clientId) {
      const owned = await tx.client.count({ where: { id: body.clientId, userId: scope.tenantId } })
      if (!owned) throw badRequest('Cliente inválido')
    }
    return tx.receivable.create({
      data: {
        userId: scope.tenantId,
        description: body.description,
        categoryId: body.categoryId,
        clientId: body.clientId ?? null,
        amountCents: body.amountCents,
        dueDate: body.dueDate,
        createdById: actorId
      },
      select: { id: true }
    })
  })
  return json({ receivable }, 201)
})
