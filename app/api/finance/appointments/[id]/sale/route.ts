export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { upsertSaleForAppointment } from '@/lib/finance/sales'
import { saleDetail } from '@/lib/finance/queries'
import { conflict } from '@/lib/finance/errors'

/**
 * POST /api/finance/appointments/[id]/sale — garante a comanda de um
 * atendimento concluído (tela de Pendências, ou se o gancho tiver falhado).
 */
export const POST = financeRoute<{ id: string }>({ requireCashOperator: true }, 'appointment_sale', async ({ scope, actorId }, _req, { id }) => {
  const sale = await inTransaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { id, userId: scope.tenantId, deletedAt: null },
      select: { status: true }
    })
    if (!appointment) throw conflict('Agendamento não encontrado')
    if (appointment.status !== 'COMPLETED') throw conflict('Só atendimentos concluídos geram comanda')
    const created = await upsertSaleForAppointment(tx, { tenantId: scope.tenantId, appointmentId: id, actorId })
    return saleDetail(tx, scope.tenantId, created.id)
  })
  return json({ sale })
})
