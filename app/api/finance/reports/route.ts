export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { incomeStatement, projectedCashFlow } from '@/lib/finance/reports'
import { loadTimezone } from '@/lib/finance/context'
import { badRequest } from '@/lib/finance/errors'
import { tenantCalendarDayWindow, todayInZone } from '@/lib/timezone'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&days=30 — DRE (caixa e competência) e fluxo projetado. MASTER. */
export const GET = financeRoute({ requireMaster: true }, 'reports', async ({ scope }, request) => {
  const params = request.nextUrl.searchParams
  const days = Math.min(90, Math.max(7, Number(params.get('days')) || 30))
  const data = await inTransaction(async (tx) => {
    const tz = await loadTimezone(tx, scope.tenantId)
    const today = todayInZone(tz)
    const fromStr = params.get('from') ?? `${today.slice(0, 8)}01`
    const toStr = params.get('to') ?? today
    if (!DATE.test(fromStr) || !DATE.test(toStr) || fromStr > toStr) throw badRequest('Período inválido')
    const from = tenantCalendarDayWindow(tz, fromStr).start
    const to = tenantCalendarDayWindow(tz, toStr).end
    const [statement, cashFlow] = await Promise.all([
      incomeStatement(tx, scope.tenantId, from, to),
      projectedCashFlow(tx, scope.tenantId, days)
    ])
    return { from: fromStr, to: toStr, statement, cashFlow }
  })
  return json(data)
})
