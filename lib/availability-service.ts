import { prisma } from '@/lib/db'
import {
  DEFAULT_TIMEZONE,
  addCalendarDays,
  dayOfWeekFromDateStr,
  tenantCalendarDayWindow,
  todayInZone,
  wallTimeToInstant,
} from '@/lib/timezone'
import type { Prisma } from '@prisma/client'

// Um agendamento pode começar antes do dia pedido e invadi-lo. A janela de
// ocupação recua além da meia-noite do negócio pra não perder essa sobreposição
// — o guard de escrita já fazia o mesmo (MAX_APPOINTMENT_LOOKBACK_MINUTES).
const OCCUPANCY_LOOKBACK_MS = 24 * 60 * 60 * 1000

export interface AvailabilitySlot {
  time: string
  available: boolean
}

/**
 * Testa sobreposição de dois intervalos [start, start+duration). Único ponto
 * de verdade pra essa conta — reutilizado pelo motor de slots e pelo guard de
 * conflito em `appointment-service.ts`, que antes reimplementava a mesma
 * lógica com uma formulação de 3 termos equivalente a esta.
 */
export function overlaps(aStart: Date, aDuration: number, bStart: Date, bDuration: number): boolean {
  const aEnd = new Date(aStart.getTime() + aDuration * 60000)
  const bEnd = new Date(bStart.getTime() + bDuration * 60000)
  return aStart < bEnd && aEnd > bStart
}

/**
 * Calcula os horários disponíveis de uma agenda/serviço num dia específico,
 * considerando dias de trabalho, bloqueios, horário de almoço, antecedência
 * mínima/máxima e agendamentos já existentes. Único motor de disponibilidade do
 * sistema — compartilhado pela página pública de agendamento, pelas ferramentas
 * do agente de IA (widget de chat) e pela tela de agendamento do dashboard —
 * mesma regra em todos, incluindo a capacidade por profissional (ver `professionalId`).
 *
 * Todo o cálculo acontece no fuso do negócio (`BusinessConfig.timezone`), nunca
 * no fuso do processo: em produção as Functions do Netlify rodam em UTC, e
 * montar o horário de parede do slot com métodos locais comparava 15:00Z contra
 * o instante realmente gravado (18:00Z, montado em GMT-3) — defasando a grade
 * inteira em 3h, exibindo como livre um horário ocupado e bloqueando outro.
 */
export async function getAvailableSlots(params: {
  scheduleId: string
  serviceId: string
  date: string
  userId: string
  professionalId?: string
}): Promise<AvailabilitySlot[] | null> {
  const { scheduleId, serviceId, date: dateStr, userId, professionalId } = params

  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    include: {
      dayConfigs: true,
      blocks: true,
      services: { where: { serviceId }, include: { service: true } },
      professionals: { select: { professionalId: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })

  if (!schedule) return null

  const service = schedule.services[0]?.service
  if (!service) return null

  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE

  const dayOfWeek = dayOfWeekFromDateStr(dateStr)

  const now = new Date()
  // Comparações de calendário como string "YYYY-MM-DD": ordem lexicográfica é
  // igual à cronológica nesse formato, e não depende de fuso nenhum.
  const today = todayInZone(timeZone, now)
  if (dateStr < today) return []
  if (dateStr > addCalendarDays(today, schedule.advanceBookingDays)) return []

  if (!schedule.workingDays.includes(dayOfWeek)) return []

  // Bloqueios são comparados pela data de calendário UTC dos instantes gravados
  // — mesma semântica que a produção (processo em UTC) já aplicava, agora sem
  // depender do fuso do processo.
  const hasBlock = schedule.blocks.some((block) => {
    const blockStartDay = new Date(block.startDate).toISOString().slice(0, 10)
    const blockEndDay = new Date(block.endDate).toISOString().slice(0, 10)
    return dateStr >= blockStartDay && dateStr <= blockEndDay
  })
  if (hasBlock) return []

  let workingHours: { startTime: string; endTime: string }[]

  if (schedule.useCustomDayConfig) {
    const dayConfig = schedule.dayConfigs.find((config) => config.dayOfWeek === dayOfWeek && config.isActive)
    if (!dayConfig) return []
    workingHours = (dayConfig.timeSlots as any[]) || []
  } else {
    workingHours = [{ startTime: schedule.startTime, endTime: schedule.endTime }]
  }

  const slots: AvailabilitySlot[] = []
  const serviceDuration = service.duration || schedule.slotDuration

  for (const workHour of workingHours) {
    const [startHour, startMinute] = workHour.startTime.split(':').map(Number)
    const [endHour, endMinute] = workHour.endTime.split(':').map(Number)

    let currentMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute

    while (currentMinutes + serviceDuration <= endMinutes) {
      const isLunchTime = Boolean(
        schedule.lunchStart &&
          schedule.lunchEnd &&
          (() => {
            const [lunchStartH, lunchStartM] = schedule.lunchStart!.split(':').map(Number)
            const [lunchEndH, lunchEndM] = schedule.lunchEnd!.split(':').map(Number)
            const lunchStartMinutes = lunchStartH * 60 + lunchStartM
            const lunchEndMinutes = lunchEndH * 60 + lunchEndM
            return currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes
          })()
      )

      if (!isLunchTime) {
        const hours = Math.floor(currentMinutes / 60)
        const minutes = currentMinutes % 60
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        slots.push({ time: timeStr, available: true })
      }

      currentMinutes += serviceDuration + (schedule.bufferTime || 0)
    }
  }

  const { start: dayStart, end: dateEnd } = tenantCalendarDayWindow(timeZone, dateStr)
  const dateStart = new Date(dayStart.getTime() - OCCUPANCY_LOOKBACK_MS)

  // Ocupação é por profissional, não por agenda: o mesmo User pode estar
  // vinculado a várias agendas (ScheduleProfessional), e um agendamento dele
  // criado numa agenda ocupa o profissional em qualquer outra também — antes,
  // filtrar só por `scheduleId` deixava esse conflito invisível de uma agenda
  // pra outra. Só cai de volta pro escopo da agenda inteira quando ela não tem
  // nenhum profissional vinculado (agenda legada, sem ScheduleProfessional).
  const relevantProfessionalIds = professionalId
    ? [professionalId]
    : schedule.professionals.map((p) => p.professionalId)

  const existingAppointments =
    relevantProfessionalIds.length > 0
      ? await prisma.appointment.findMany({
          where: {
            professionalId: { in: relevantProfessionalIds },
            date: { gte: dateStart, lte: dateEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            deletedAt: null,
          },
        })
      : await prisma.appointment.findMany({
          where: {
            scheduleId,
            date: { gte: dateStart, lte: dateEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            deletedAt: null,
          },
        })

  const appointmentsByProfessional = new Map<string, typeof existingAppointments>()
  for (const apt of existingAppointments) {
    if (!apt.professionalId) continue
    const list = appointmentsByProfessional.get(apt.professionalId) ?? []
    list.push(apt)
    appointmentsByProfessional.set(apt.professionalId, list)
  }

  const minBookingTime = new Date(now.getTime() + schedule.minNoticeHours * 60 * 60 * 1000)

  for (const slot of slots) {
    const slotDate = wallTimeToInstant(dateStr, slot.time, timeZone)

    if (slotDate < minBookingTime) {
      slot.available = false
      continue
    }

    if (relevantProfessionalIds.length > 0) {
      // Disponível se pelo menos um profissional do conjunto (o pedido, ou
      // todos os vinculados quando "qualquer um") estiver livre nesse slot.
      const someoneFree = relevantProfessionalIds.some((id) => {
        const theirAppointments = appointmentsByProfessional.get(id) ?? []
        return !theirAppointments.some((apt) => overlaps(slotDate, serviceDuration, apt.date, apt.duration))
      })
      if (!someoneFree) slot.available = false
    } else {
      // Agenda legada sem profissional vinculado: capacidade 1 pra agenda inteira.
      const occupied = existingAppointments.some((apt) => overlaps(slotDate, serviceDuration, apt.date, apt.duration))
      if (occupied) slot.available = false
    }
  }

  return slots
}

/**
 * Agendas ativas do tenant que oferecem um serviço (e, se `professionalId` for
 * dado, que também têm esse profissional vinculado). Um mesmo serviço pode
 * estar em várias agendas — a página pública e o chat de IA não pedem mais
 * `scheduleId` ao cliente, então essa é a resolução server-side que substitui
 * a escolha manual de agenda.
 */
export async function resolveCandidateSchedules(params: {
  userId: string
  serviceId: string
  professionalId?: string
  /** Client transacional, quando chamado de dentro de withBookingLock. */
  tx?: typeof prisma | Prisma.TransactionClient
}): Promise<{ id: string }[]> {
  const { userId, serviceId, professionalId, tx } = params
  const db = tx ?? prisma

  return db.schedule.findMany({
    where: {
      userId,
      isActive: true,
      services: { some: { serviceId } },
      ...(professionalId && { professionals: { some: { professionalId } } }),
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Disponibilidade de um serviço sem precisar de scheduleId: resolve as agendas
 * candidatas e une os horários de todas — um horário aparece disponível se
 * estiver livre em pelo menos uma delas. Retorna `null` quando o serviço não
 * está em nenhuma agenda (ativa) do tenant, ou nenhuma tem esse profissional.
 */
export async function getAvailableSlotsForService(params: {
  userId: string
  serviceId: string
  date: string
  professionalId?: string
}): Promise<AvailabilitySlot[] | null> {
  const { userId, serviceId, date, professionalId } = params

  const candidates = await resolveCandidateSchedules({ userId, serviceId, professionalId })
  if (candidates.length === 0) return null

  const slotsPerSchedule = await Promise.all(
    candidates.map((schedule) =>
      getAvailableSlots({ scheduleId: schedule.id, serviceId, date, userId, professionalId })
    )
  )

  const merged = new Map<string, boolean>()
  for (const slots of slotsPerSchedule) {
    if (!slots) continue
    for (const slot of slots) {
      merged.set(slot.time, (merged.get(slot.time) ?? false) || slot.available)
    }
  }

  return Array.from(merged.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, available]) => ({ time, available }))
}
