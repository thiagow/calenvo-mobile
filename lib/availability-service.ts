import { prisma } from '@/lib/db'

export interface AvailabilitySlot {
  time: string
  available: boolean
}

/**
 * Constrói uma Date à meia-noite local a partir de "YYYY-MM-DD".
 *
 * `new Date(dateStr)` parseia a string como meia-noite UTC; combinar isso com
 * métodos locais (`getDay`, `setHours`) desalinha o dia sempre que o processo
 * roda fora de UTC — ex.: "2026-07-21" virava terça (dia real) só em servidor
 * UTC, mas segunda-feira num servidor em GMT-3, porque meia-noite UTC de dia
 * 21 já é 21h do dia 20 em Brasília. Construir a partir dos componentes
 * locais evita o problema, independente do timezone do processo.
 */
export function parseCalendarDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Calcula os horários disponíveis de uma agenda/serviço num dia específico,
 * considerando dias de trabalho, bloqueios, horário de almoço, antecedência
 * mínima/máxima e agendamentos já existentes. Único motor de disponibilidade do
 * sistema — compartilhado pela página pública de agendamento, pelas ferramentas
 * do agente de IA (widget de chat) e pela tela de agendamento do dashboard —
 * mesma regra em todos, incluindo a capacidade por profissional (ver `professionalId`).
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
    },
  })

  if (!schedule) return null

  const service = schedule.services[0]?.service
  if (!service) return null

  const date = parseCalendarDate(dateStr)
  const dayOfWeek = date.getDay()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date < todayStart) return []

  const maxBookingDate = new Date(todayStart)
  maxBookingDate.setDate(maxBookingDate.getDate() + schedule.advanceBookingDays)
  if (date > maxBookingDate) return []

  if (!schedule.workingDays.includes(dayOfWeek)) return []

  const hasBlock = schedule.blocks.some((block) => {
    const blockStart = new Date(block.startDate)
    const blockEnd = new Date(block.endDate)
    return date >= blockStart && date <= blockEnd
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

  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const dateEnd = new Date(date)
  dateEnd.setHours(23, 59, 59, 999)

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      scheduleId,
      date: { gte: dateStart, lte: dateEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(professionalId && { professionalId }),
    },
  })

  // Sem profissional específico ("qualquer um"), a agenda tem capacidade para até
  // N atendimentos simultâneos — um por profissional vinculado — em vez de travar
  // no primeiro agendamento existente. Com um profissional específico, a
  // capacidade é sempre 1 (a query acima já filtrou só os agendamentos dele).
  const capacity = professionalId ? 1 : Math.max(1, schedule.professionals.length)
  const minBookingTime = new Date(now.getTime() + schedule.minNoticeHours * 60 * 60 * 1000)

  for (const slot of slots) {
    const [slotHour, slotMinute] = slot.time.split(':').map(Number)
    const slotDate = new Date(date)
    slotDate.setHours(slotHour, slotMinute, 0, 0)
    const slotEndDate = new Date(slotDate.getTime() + serviceDuration * 60000)

    if (slotDate < minBookingTime) {
      slot.available = false
      continue
    }

    const overlapCount = existingAppointments.filter((apt) => {
      const aptDate = new Date(apt.date)
      const aptEndDate = new Date(aptDate.getTime() + apt.duration * 60000)
      return (
        (slotDate >= aptDate && slotDate < aptEndDate) ||
        (slotEndDate > aptDate && slotEndDate <= aptEndDate) ||
        (slotDate <= aptDate && slotEndDate >= aptEndDate)
      )
    }).length

    if (overlapCount >= capacity) {
      slot.available = false
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
}): Promise<{ id: string }[]> {
  const { userId, serviceId, professionalId } = params

  return prisma.schedule.findMany({
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
