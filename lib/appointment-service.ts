import { prisma } from '@/lib/db'
import { canCreateAppointment, getRemainingAppointments } from '@/lib/plan-limits'
import { resolveCandidateSchedules } from '@/lib/availability-service'
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

export interface ProfessionalResolution {
  professionalId: string | null
  error?: string
}

/**
 * Resolve qual profissional fica com um novo agendamento — único lugar que decide
 * isso, usado por todos os pontos de criação (booking público, chat de IA,
 * dashboard, API v1). Sem essa centralização, cada rota fazia sua própria checagem
 * solta de `checkScheduleConflict` e a capacidade por profissional divergia entre
 * elas.
 */
export async function resolveProfessionalForBooking(params: {
  scheduleId: string
  date: Date
  duration: number
  requestedProfessionalId?: string | null
}): Promise<ProfessionalResolution> {
  const { scheduleId, date, duration, requestedProfessionalId } = params

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { professionals: { select: { professionalId: true } } },
  })
  const linkedIds = schedule?.professionals.map((p) => p.professionalId) || []

  if (requestedProfessionalId) {
    if (!linkedIds.includes(requestedProfessionalId)) {
      return { professionalId: null, error: 'Profissional não vinculado a esta agenda' }
    }
    const conflict = await checkScheduleConflict({ scheduleId, professionalId: requestedProfessionalId, date, duration })
    if (conflict) {
      return { professionalId: null, error: 'Este profissional já está ocupado nesse horário' }
    }
    return { professionalId: requestedProfessionalId }
  }

  // Agenda legada sem nenhum profissional vinculado: mantém o comportamento
  // histórico (sem atribuição, conflito checado pra agenda inteira).
  if (linkedIds.length === 0) {
    const conflict = await checkScheduleConflict({ scheduleId, date, duration })
    return conflict
      ? { professionalId: null, error: 'Este horário acabou de ficar indisponível' }
      : { professionalId: null }
  }

  for (const id of linkedIds) {
    const conflict = await checkScheduleConflict({ scheduleId, professionalId: id, date, duration })
    if (!conflict) {
      return { professionalId: id }
    }
  }

  return { professionalId: null, error: 'Este horário acabou de ficar indisponível' }
}

export interface BookingTargetResolution {
  scheduleId: string | null
  professionalId: string | null
  error?: string
}

/**
 * Resolve, a partir só de serviceId (+ professionalId opcional), qual agenda e
 * qual profissional recebem um novo agendamento — o cliente final não escolhe
 * mais a agenda diretamente. Tenta cada agenda candidata (`resolveCandidateSchedules`)
 * em ordem e usa a primeira em que `resolveProfessionalForBooking` não retornar erro.
 */
export async function resolveBookingTarget(params: {
  userId: string
  serviceId: string
  date: Date
  duration: number
  requestedProfessionalId?: string | null
}): Promise<BookingTargetResolution> {
  const { userId, serviceId, date, duration, requestedProfessionalId } = params

  const candidates = await resolveCandidateSchedules({
    userId,
    serviceId,
    professionalId: requestedProfessionalId || undefined,
  })

  if (candidates.length === 0) {
    return { scheduleId: null, professionalId: null, error: 'Nenhuma agenda disponível para este serviço' }
  }

  let lastError: string | undefined
  for (const candidate of candidates) {
    const resolution = await resolveProfessionalForBooking({
      scheduleId: candidate.id,
      date,
      duration,
      requestedProfessionalId,
    })
    if (!resolution.error) {
      return { scheduleId: candidate.id, professionalId: resolution.professionalId }
    }
    lastError = resolution.error
  }

  return { scheduleId: null, professionalId: null, error: lastError || 'Este horário acabou de ficar indisponível' }
}
