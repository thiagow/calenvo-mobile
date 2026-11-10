export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { listPendingAppointments } from '@/lib/finance/reports'
import { toCents } from '@/lib/finance/money'

/** GET /api/finance/pending — atendimentos concluídos desde a ativação sem comanda. */
export const GET = financeRoute({ requireCashOperator: true }, 'pending', async ({ scope }) => {
  const rows = await inTransaction((tx) => listPendingAppointments(tx, scope.tenantId))
  return json({
    appointments: rows.map((a) => ({
      id: a.id,
      date: a.date,
      clientName: a.client.name,
      serviceName: a.service?.name ?? null,
      professionalName: a.professionalUser?.name ?? null,
      priceCents: toCents(a.price) ?? toCents(a.service?.price) ?? 0
    }))
  })
})
