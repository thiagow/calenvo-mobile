import { prisma } from '@/lib/db'
import { canCreateAppointment, getRemainingAppointments } from '@/lib/plan-limits'
import { resolveCandidateSchedules, overlaps } from '@/lib/availability-service'
import { PlanType, AppointmentStatus, Prisma } from '@prisma/client'
import { formatWhatsAppNumber } from '@/lib/utils'
import { NotificationService } from '@/lib/notification-service'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'

const OPEN_APPOINTMENT_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']

type DbClient = typeof prisma | Prisma.TransactionClient

// Nenhum agendamento real passa disso — só existe pra dar um limite inferior
// à busca de conflito, que antes escaneava o histórico inteiro da agenda a
// cada tentativa de reserva (`date: { lt: appointmentEnd }` sem piso).
const MAX_APPOINTMENT_LOOKBACK_MINUTES = 24 * 60

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
      deletedAt: null,
    },
  })

  return {
    allowed: canCreateAppointment(planType, currentCount),
    currentCount,
    remaining: getRemainingAppointments(planType, currentCount),
  }
}

/**
 * Verifica sobreposição de horário para um profissional (globalmente, em
 * qualquer agenda em que ele atenda) ou, na ausência de profissional, para a
 * agenda inteira (caso legado, sem nenhum ScheduleProfessional vinculado).
 * Baseado em intervalo de início/fim, não em igualdade exata de data/hora —
 * pega conflitos parciais também. Mesma regra usada pelo motor de slots em
 * `availability-service.ts`, que é quem primeiro deveria ter escondido esse
 * horário — este é o guard de última linha na escrita.
 */
export async function checkBookingConflict(params: {
  scheduleId: string
  professionalId?: string | null
  date: Date
  duration: number
  excludeAppointmentId?: string
  tx?: DbClient
}): Promise<boolean> {
  const { scheduleId, professionalId, date, duration, excludeAppointmentId, tx } = params
  const db = tx ?? prisma
  const appointmentEnd = new Date(date.getTime() + duration * 60000)
  const lookbackStart = new Date(date.getTime() - MAX_APPOINTMENT_LOOKBACK_MINUTES * 60000)

  const whereClause: any = professionalId
    ? {
        professionalId,
        date: { gte: lookbackStart, lt: appointmentEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        deletedAt: null,
      }
    : {
        scheduleId,
        date: { gte: lookbackStart, lt: appointmentEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        deletedAt: null,
      }

  if (excludeAppointmentId) {
    whereClause.id = { not: excludeAppointmentId }
  }

  const candidates = await db.appointment.findMany({
    where: whereClause,
    select: { date: true, duration: true },
  })

  return candidates.some((appointment) => overlaps(date, duration, appointment.date, appointment.duration))
}

/**
 * Serializa a checagem de conflito + criação para uma chave (profissional, ou
 * agenda quando não há profissional) usando um advisory lock do Postgres.
 * Sem isso, dois pedidos concorrentes pro mesmo horário passam ambos pelo
 * check-then-write em memória e ambos inserem — não existe unique/exclusion
 * constraint no schema hoje que pegasse essa corrida (Appointment só tem
 * `date` + `duration`, não um range, e scheduleId/professionalId são
 * nullable). O lock é liberado automaticamente ao fim da transação.
 */
export async function withBookingLock<T>(key: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    return fn(tx)
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
  /** Tenant dono da agenda — sem isso, um scheduleId de outro tenant (ou já
   * excluído) caía silenciosamente no ramo "agenda legada sem profissional"
   * em vez de ser rejeitado, e só estourava mais adiante como violação de FK
   * no create. */
  userId: string
  date: Date
  duration: number
  requestedProfessionalId?: string | null
  /**
   * "Encaixe": ignora conflito de horário e força o profissional pedido (ou
   * a agenda legada) mesmo já ocupado. Só deve vir `true` a partir do
   * dashboard interno, nunca do booking público ou da API v1/chat — quem
   * chama esta função é responsável por checar a permissão antes.
   */
  allowOverbook?: boolean
  /** Client transacional, quando chamado de dentro de withBookingLock. */
  tx?: DbClient
}): Promise<ProfessionalResolution> {
  const { scheduleId, userId, date, duration, requestedProfessionalId, allowOverbook, tx } = params
  const db = tx ?? prisma

  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: { professionals: { select: { professionalId: true } } },
  })
  if (!schedule) {
    return { professionalId: null, error: 'Agenda não encontrada' }
  }
  const linkedIds = schedule.professionals.map((p) => p.professionalId)

  if (requestedProfessionalId) {
    if (!linkedIds.includes(requestedProfessionalId)) {
      return { professionalId: null, error: 'Profissional não vinculado a esta agenda' }
    }
    if (allowOverbook) {
      return { professionalId: requestedProfessionalId }
    }
    const conflict = await checkBookingConflict({ scheduleId, professionalId: requestedProfessionalId, date, duration, tx })
    if (conflict) {
      return { professionalId: null, error: 'Este profissional já está ocupado nesse horário' }
    }
    return { professionalId: requestedProfessionalId }
  }

  // Agenda legada sem nenhum profissional vinculado: mantém o comportamento
  // histórico (sem atribuição, conflito checado pra agenda inteira).
  if (linkedIds.length === 0) {
    if (allowOverbook) {
      return { professionalId: null }
    }
    const conflict = await checkBookingConflict({ scheduleId, date, duration, tx })
    return conflict
      ? { professionalId: null, error: 'Este horário acabou de ficar indisponível' }
      : { professionalId: null }
  }

  if (allowOverbook) {
    return { professionalId: linkedIds[0] }
  }

  for (const id of linkedIds) {
    const conflict = await checkBookingConflict({ scheduleId, professionalId: id, date, duration, tx })
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
  /** Client transacional, quando chamado de dentro de withBookingLock. */
  tx?: DbClient
}): Promise<BookingTargetResolution> {
  const { userId, serviceId, date, duration, requestedProfessionalId, tx } = params

  const candidates = await resolveCandidateSchedules({
    userId,
    serviceId,
    professionalId: requestedProfessionalId || undefined,
    tx,
  })

  if (candidates.length === 0) {
    return { scheduleId: null, professionalId: null, error: 'Nenhuma agenda disponível para este serviço' }
  }

  let lastError: string | undefined
  for (const candidate of candidates) {
    const resolution = await resolveProfessionalForBooking({
      scheduleId: candidate.id,
      userId,
      date,
      duration,
      requestedProfessionalId,
      tx,
    })
    if (!resolution.error) {
      return { scheduleId: candidate.id, professionalId: resolution.professionalId }
    }
    lastError = resolution.error
  }

  return { scheduleId: null, professionalId: null, error: lastError || 'Este horário acabou de ficar indisponível' }
}

export interface OpenAppointmentSummary {
  id: string
  date: Date
  duration: number
  status: string
  serviceName: string
  professionalName: string | null
  canCancel: boolean
}

/**
 * Regra única de "o cliente ainda pode cancelar este agendamento?" — usada tanto
 * pela consulta (pra decidir se mostra o botão) quanto pelo cancelamento em si
 * (pra revalidar no servidor, nunca confiando só na UI).
 */
export function isCancellableByClient(
  appointment: { date: Date; status: AppointmentStatus },
  businessConfig: { allowClientCancellation: boolean; cancellationHours: number } | null
): boolean {
  if (!businessConfig?.allowClientCancellation) return false
  if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) return false
  const cutoff = new Date(Date.now() + businessConfig.cancellationHours * 60 * 60 * 1000)
  return appointment.date >= cutoff
}

/**
 * Busca os agendamentos abertos (não concluídos/cancelados) de um cliente pelo
 * telefone, escopados ao tenant — usado tanto pelo booking público quanto pelo
 * tool do chat widget.
 */
export async function getClientOpenAppointments(tenantId: string, phone: string): Promise<OpenAppointmentSummary[]> {
  const normalizedPhone = formatWhatsAppNumber(phone) || phone

  const client = await prisma.client.findFirst({
    where: { userId: tenantId, phone: normalizedPhone },
    select: { id: true },
  })
  if (!client) return []

  const businessConfig = await prisma.businessConfig.findUnique({
    where: { userId: tenantId },
    select: { allowClientCancellation: true, cancellationHours: true },
  })

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: tenantId,
      clientId: client.id,
      status: { in: OPEN_APPOINTMENT_STATUSES },
      deletedAt: null,
    },
    include: {
      service: { select: { name: true } },
      professionalUser: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  return appointments.map((a) => ({
    id: a.id,
    date: a.date,
    duration: a.duration,
    status: a.status,
    serviceName: a.service?.name || a.specialty || 'Agendamento',
    professionalName: a.professionalUser?.name || a.professional || null,
    canCancel: isCancellableByClient(a, businessConfig),
  }))
}

export type CancelAsClientErrorCode =
  | 'NOT_FOUND'
  | 'PHONE_MISMATCH'
  | 'POLICY_DISABLED'
  | 'STATUS_CLOSED'
  | 'POLICY_WINDOW'

export interface CancelAsClientResult {
  success: boolean
  error?: string
  /** Código estável para o chamador decidir o que fazer sem parsear a mensagem. */
  code?: CancelAsClientErrorCode
}

/**
 * Cancela um agendamento em nome do cliente (booking público / chat widget) —
 * sempre revalida no servidor: telefone é dono do agendamento, cancelamento
 * habilitado pelo negócio, e ainda dentro da janela de antecedência mínima.
 */
export async function cancelAppointmentAsClient(params: {
  tenantId: string
  phone: string
  appointmentId: string
  reason?: string
}): Promise<CancelAsClientResult> {
  const { tenantId, phone, appointmentId, reason } = params
  const normalizedPhone = formatWhatsAppNumber(phone) || phone

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId: tenantId, deletedAt: null },
    include: {
      client: true,
      service: { select: { name: true } },
      professionalUser: { select: { name: true, whatsapp: true, phone: true } },
      user: { select: { businessName: true, whatsapp: true, phone: true } },
    },
  })
  if (!appointment) return { success: false, error: 'Agendamento não encontrado', code: 'NOT_FOUND' }
  if (appointment.client.phone !== normalizedPhone) {
    return { success: false, error: 'Este agendamento não pertence a este telefone', code: 'PHONE_MISMATCH' }
  }

  const businessConfig = await prisma.businessConfig.findUnique({
    where: { userId: tenantId },
    select: { allowClientCancellation: true, cancellationHours: true },
  })

  if (!businessConfig?.allowClientCancellation) {
    return { success: false, error: 'O cancelamento pelo cliente não está habilitado para este negócio', code: 'POLICY_DISABLED' }
  }
  if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) {
    return { success: false, error: 'Este agendamento não pode mais ser cancelado', code: 'STATUS_CLOSED' }
  }
  if (!isCancellableByClient(appointment, businessConfig)) {
    return {
      success: false,
      error: `Cancelamento permitido apenas até ${businessConfig.cancellationHours}h antes do agendamento`,
      code: 'POLICY_WINDOW',
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'CANCELLED', cancellationReason: reason || null },
    include: {
      client: true,
      service: { select: { name: true } },
      professionalUser: { select: { name: true, whatsapp: true, phone: true } },
      user: { select: { businessName: true, whatsapp: true, phone: true } },
    },
  })

  const serviceName = updated.service?.name || updated.specialty || 'Agendamento'
  const professionalName = updated.professionalUser?.name || updated.professional || undefined

  try {
    await NotificationService.notifyAppointmentCancelled(tenantId, updated.id, updated.client.name, serviceName, updated.date)
    await WhatsAppTriggerService.onAppointmentCancelled(updated as any, serviceName, professionalName)
    await WhatsAppTriggerService.onAppointmentCancelledByClient(updated as any, serviceName, professionalName)
  } catch (error) {
    console.error('[cancelAppointmentAsClient] Erro ao notificar cancelamento:', error)
  }

  return { success: true }
}

export interface ConfirmAsClientResult {
  success: boolean
  error?: string
  alreadyConfirmed?: boolean
}

/**
 * Confirma um agendamento em nome do cliente (link de confirmação por WhatsApp).
 * Diferente de cancelAppointmentAsClient, não precisa casar telefone: quem
 * chama já resolveu o appointmentId a partir de um token de 128 bits — o
 * token É a autorização. Idempotente: confirmar duas vezes (double-tap,
 * reenvio de webhook) é sucesso silencioso, sem notificar de novo.
 */
export async function confirmAppointmentAsClient(params: {
  tenantId: string
  appointmentId: string
}): Promise<ConfirmAsClientResult> {
  const { tenantId, appointmentId } = params

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId: tenantId, deletedAt: null },
    include: {
      client: true,
      service: { select: { name: true } },
      professionalUser: { select: { name: true } },
    },
  })
  if (!appointment) return { success: false, error: 'Agendamento não encontrado' }

  if (appointment.status === 'CONFIRMED' || appointment.status === 'IN_PROGRESS') {
    return { success: true, alreadyConfirmed: true }
  }
  if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) {
    return { success: false, error: 'Este agendamento não pode mais ser confirmado' }
  }
  if (appointment.date < new Date()) {
    return { success: false, error: 'Este agendamento já passou' }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
    include: { client: true, service: { select: { name: true } } },
  })

  const serviceName = updated.service?.name || updated.specialty || 'Agendamento'

  try {
    await NotificationService.notifyAppointmentConfirmed(tenantId, updated.id, updated.client.name, serviceName, updated.date)
  } catch (error) {
    console.error('[confirmAppointmentAsClient] Erro ao notificar confirmação:', error)
  }

  return { success: true }
}
