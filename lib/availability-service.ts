import { prisma } from '@/lib/db'

export interface AvailabilitySlot {
  time: string
  available: boolean
}

/**
 * Calcula os horários disponíveis de uma agenda/serviço num dia específico,
 * considerando dias de trabalho, bloqueios, horário de almoço e agendamentos
 * já existentes. Compartilhado entre a página pública de agendamento e as
 * ferramentas do agente de IA (widget de chat) — mesma regra em ambos.
 */
export async function getAvailableSlots(params: {
  scheduleId: string
  serviceId: string
  date: string
}): Promise<AvailabilitySlot[] | null> {
  const { scheduleId, serviceId, date: dateStr } = params

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      dayConfigs: true,
      blocks: true,
      services: { where: { serviceId }, include: { service: true } },
    },
  })

  if (!schedule) return null

  const service = schedule.services[0]?.service
  if (!service) return null

  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()

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
    },
  })

  for (const slot of slots) {
    const [slotHour, slotMinute] = slot.time.split(':').map(Number)
    const slotDate = new Date(date)
    slotDate.setHours(slotHour, slotMinute, 0, 0)
    const slotEndDate = new Date(slotDate.getTime() + serviceDuration * 60000)

    const hasConflict = existingAppointments.some((apt) => {
      const aptDate = new Date(apt.date)
      const aptEndDate = new Date(aptDate.getTime() + apt.duration * 60000)
      return (
        (slotDate >= aptDate && slotDate < aptEndDate) ||
        (slotEndDate > aptDate && slotEndDate <= aptEndDate) ||
        (slotDate <= aptDate && slotEndDate >= aptEndDate)
      )
    })

    if (hasConflict) {
      slot.available = false
    }
  }

  return slots
}
