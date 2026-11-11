export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { badRequest } from '@/lib/finance/errors'
import { loadTimezone } from '@/lib/finance/context'
import { loadForecastAppointments } from '@/lib/finance/forecast'
import { tenantCalendarDayWindow } from '@/lib/timezone'

/** GET /api/finance/forecast/day?date=YYYY-MM-DD — MASTER. Agendamentos previstos de um dia, sob demanda. */
export const GET = financeRoute({ requireMaster: true }, 'forecast_day', async ({ scope }, request) => {
  const date = request.nextUrl.searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Data inválida')

  const appointments = await inTransaction(async (tx) => {
    const timezone = await loadTimezone(tx, scope.tenantId)
    return loadForecastAppointments(tx, scope.tenantId, tenantCalendarDayWindow(timezone, date), timezone)
  })
  return json({
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      status: a.status,
      clientName: a.clientName,
      serviceName: a.serviceName,
      professionalName: a.professionalName,
      priceCents: a.priceCents,
      isPackageSession: a.isPackageSession
    }))
  })
})
