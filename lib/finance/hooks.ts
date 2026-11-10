import { prisma } from '@/lib/db'
import { logError } from '@/lib/error-logger'
import { isFinanceEnabled } from './status'
import { cancelSaleForAppointment, createSaleForPackage, upsertSaleForAppointment } from './sales'

// Várias consultas por comanda num banco remoto: o timeout padrão (5s) é curto.
const TX_OPTIONS = { timeout: 15_000, maxWait: 5_000 }

/**
 * Únicos pontos em que o núcleo do Calenvo conversa com o Módulo Financeiro.
 * Com o módulo desligado não fazem nada. Nunca lançam erro: falha vira
 * ErrorLog e aparece na tela de Pendências para gerar a comanda depois.
 */

export async function onAppointmentCompleted(params: { tenantId: string; appointmentId: string; actorId: string | null }) {
  try {
    if (!(await isFinanceEnabled(params.tenantId))) return null
    const sale = await prisma.$transaction((tx) => upsertSaleForAppointment(tx, params), TX_OPTIONS)
    return { saleId: sale.id }
  } catch (error) {
    console.error('[finance] onAppointmentCompleted failed:', error)
    await logError({
      functionality: 'finance_appointment_completed',
      error,
      userId: params.tenantId,
      metadata: { appointmentId: params.appointmentId }
    })
    return null
  }
}

export async function onAppointmentUncompleted(params: { tenantId: string; appointmentId: string; actorId: string | null }) {
  try {
    if (!(await isFinanceEnabled(params.tenantId))) return
    const outcome = await prisma.$transaction((tx) => cancelSaleForAppointment(tx, params), TX_OPTIONS)
    if (outcome === 'blocked_has_payments') {
      await prisma.notification.create({
        data: {
          userId: params.tenantId,
          title: 'Atendimento reaberto com pagamento',
          message:
            'Um atendimento já pago voltou a ficar em aberto. A comanda foi mantida; se o valor deve ser devolvido, estorne o pagamento em Financeiro → A receber.',
          type: 'SYSTEM'
        }
      })
    }
  } catch (error) {
    console.error('[finance] onAppointmentUncompleted failed:', error)
    await logError({
      functionality: 'finance_appointment_uncompleted',
      error,
      userId: params.tenantId,
      metadata: { appointmentId: params.appointmentId }
    })
  }
}

export async function onPackageSold(params: { tenantId: string; clientPackageId: string; actorId: string | null }) {
  try {
    if (!(await isFinanceEnabled(params.tenantId))) return
    await prisma.$transaction((tx) => createSaleForPackage(tx, params), TX_OPTIONS)
  } catch (error) {
    console.error('[finance] onPackageSold failed:', error)
    await logError({
      functionality: 'finance_package_sold',
      error,
      userId: params.tenantId,
      metadata: { clientPackageId: params.clientPackageId }
    })
  }
}
