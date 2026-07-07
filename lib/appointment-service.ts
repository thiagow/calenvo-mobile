import { prisma } from '@/lib/db'
import { canCreateAppointment, getRemainingAppointments } from '@/lib/plan-limits'
import { PlanType } from '@prisma/client'

export interface QuotaCheckResult {
  allowed: boolean
  currentCount: number
  remaining: number
}

/**
 * Verifica se o tenant ainda tem espaço no limite mensal de agendamentos do plano.
 * Regra única e compartilhada entre dashboard, booking público e API pública —
 * nenhuma dessas entradas deve ter critério de quota divergente das outras.
 */
export async function checkAppointmentQuota(userId: string, planType: PlanType): Promise<QuotaCheckResult> {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const currentCount = await prisma.appointment.count({
    where: {
      userId,
      date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
  })

  return {
    allowed: canCreateAppointment(planType, currentCount),
    currentCount,
    remaining: getRemainingAppointments(planType, currentCount),
  }
}

/**
 * Verifica sobreposição de horário numa agenda (opcionalmente restrita a um
 * profissional específico). Baseado em intervalo de início/fim, não em
 * igualdade exata de data/hora — pega conflitos parciais também.
 */
export async function checkScheduleConflict(params: {
  scheduleId: string
  professionalId?: string | null
  date: Date
  duration: number
  excludeAppointmentId?: string
}): Promise<boolean> {
  const { scheduleId, professionalId, date, duration, excludeAppointmentId } = params
  const appointmentEnd = new Date(date.getTime() + duration * 60000)

  const whereClause: any = {
    scheduleId,
    date: { lt: appointmentEnd },
    status: { notIn: ['CANCELLED', 'NO_SHOW'] },
  }

  if (professionalId) {
    whereClause.professionalId = professionalId
  }

  if (excludeAppointmentId) {
    whereClause.id = { not: excludeAppointmentId }
  }

  const candidates = await prisma.appointment.findMany({
    where: whereClause,
    select: { date: true, duration: true },
  })

  return candidates.some((appointment) => {
    const existingStart = appointment.date
    const existingEnd = new Date(existingStart.getTime() + appointment.duration * 60000)
    return date < existingEnd && appointmentEnd > existingStart
  })
}
