import { randomUUID } from 'crypto'
import { buildPaymentSchedule } from './entries'
import { assertCategory, type Tx } from './context'
import { conflict, notFound } from './errors'

export async function createPayables(
  tx: Tx,
  params: {
    tenantId: string
    actorId: string
    categoryId: string
    description: string
    supplier?: string | null
    notes?: string | null
    amountCents: number
    firstDueDate: Date
    mode: 'SINGLE' | 'INSTALLMENTS' | 'RECURRING'
    count: number
  }
) {
  await assertCategory(tx, params.tenantId, params.categoryId, 'EXPENSE')
  const schedule = buildPaymentSchedule(params.mode, params.amountCents, params.firstDueDate, params.count)
  const seriesId = schedule.length > 1 ? randomUUID() : null

  await tx.payable.createMany({
    data: schedule.map((entry) => ({
      userId: params.tenantId,
      categoryId: params.categoryId,
      description: params.description.trim(),
      supplier: params.supplier?.trim() || null,
      notes: params.notes?.trim() || null,
      amountCents: entry.amountCents,
      dueDate: entry.dueDate,
      seriesId,
      installment: seriesId ? entry.installment : null,
      ofInstallments: seriesId ? entry.ofInstallments : null,
      createdById: params.actorId
    }))
  })
  return { count: schedule.length, seriesId }
}

/** Cancela uma conta (ou as próximas em aberto da mesma série). Conta com pagamento exige estorno antes. */
export async function cancelPayable(tx: Tx, params: { tenantId: string; payableId: string; includeFollowing: boolean }) {
  const payable = await tx.payable.findFirst({ where: { id: params.payableId, userId: params.tenantId } })
  if (!payable) throw notFound('Conta a pagar')
  if (payable.paidCents > 0) throw conflict('Esta conta tem pagamento registrado. Estorne o pagamento antes de cancelar.')

  const where =
    params.includeFollowing && payable.seriesId
      ? { userId: params.tenantId, seriesId: payable.seriesId, dueDate: { gte: payable.dueDate }, paidCents: 0, status: { not: 'CANCELLED' as const } }
      : { id: payable.id }
  const { count } = await tx.payable.updateMany({ where, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  return { count }
}
