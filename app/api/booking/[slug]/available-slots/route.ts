import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const searchParams = request.nextUrl.searchParams
    const scheduleId = searchParams.get('scheduleId')
    const serviceId = searchParams.get('serviceId')
    const dateStr = searchParams.get('date')

    if (!scheduleId || !serviceId || !dateStr) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: scheduleId, serviceId, date' },
        { status: 400 }
      )
    }

    // Buscar agenda com configurações
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        dayConfigs: true,
        blocks: true,
        services: {
          where: { serviceId },
          include: { service: true }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Agenda não encontrada' },
        { status: 404 }
      )
    }

    const service = schedule.services[0]?.service
    if (!service) {
      return NextResponse.json(
        { error: 'Serviço não encontrado' },
        { status: 404 }
      )
    }

    const date = new Date(dateStr)
    const dayOfWeek = date.getDay()

    // Verificar se o dia está nos dias de trabalho
    if (!schedule.workingDays.includes(dayOfWeek)) {
      return NextResponse.json({ slots: [] })
    }

    // Verificar se há bloqueio para este dia
    const hasBlock = schedule.blocks.some(block => {
      const blockStart = new Date(block.startDate)
      const blockEnd = new Date(block.endDate)
      return date >= blockStart && date <= blockEnd
    })

    if (hasBlock) {
      return NextResponse.json({ slots: [] })
    }

    // Determinar horários de trabalho
    let workingHours: { startTime: string; endTime: string }[]

    if (schedule.useCustomDayConfig) {
      const dayConfig = schedule.dayConfigs.find(
        config => config.dayOfWeek === dayOfWeek && config.isActive
      )

      if (!dayConfig) {
        return NextResponse.json({ slots: [] })
      }

      workingHours = (dayConfig.timeSlots as any[]) || []
    } else {
      workingHours = [{
        startTime: schedule.startTime,
        endTime: schedule.endTime
      }]
    }

    // Gerar slots de horário
    const slots: { time: string; available: boolean }[] = []
    const serviceDuration = service.duration || schedule.slotDuration

    for (const workHour of workingHours) {
      const [startHour, startMinute] = workHour.startTime.split(':').map(Number)
      const [endHour, endMinute] = workHour.endTime.split(':').map(Number)

      let currentMinutes = startHour * 60 + startMinute
      const endMinutes = endHour * 60 + endMinute

      while (currentMinutes + serviceDuration <= endMinutes) {
        // Verificar horário de almoço
        const isLunchTime = schedule.lunchStart && schedule.lunchEnd && (
          () => {
            const [lunchStartH, lunchStartM] = schedule.lunchStart!.split(':').map(Number)
            const [lunchEndH, lunchEndM] = schedule.lunchEnd!.split(':').map(Number)
            const lunchStartMinutes = lunchStartH * 60 + lunchStartM
            const lunchEndMinutes = lunchEndH * 60 + lunchEndM
            return currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes
          }
        )()

        if (!isLunchTime) {
          const hours = Math.floor(currentMinutes / 60)
          const minutes = currentMinutes % 60
          const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

          slots.push({
            time: timeStr,
            available: true // TODO: Verificar agendamentos existentes
          })
        }

        currentMinutes += serviceDuration + (schedule.bufferTime || 0)
      }
    }

    // Buscar agendamentos existentes para verificar disponibilidade
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    const dateEnd = new Date(date)
    dateEnd.setHours(23, 59, 59, 999)

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        scheduleId,
        date: {
          gte: dateStart,
          lte: dateEnd
        },
        status: {
          notIn: ['CANCELLED', 'NO_SHOW']
        }
      }
    })

    // Marcar slots indisponíveis
    for (const slot of slots) {
      const [slotHour, slotMinute] = slot.time.split(':').map(Number)
      const slotDate = new Date(date)
      slotDate.setHours(slotHour, slotMinute, 0, 0)

      const hasConflict = existingAppointments.some(apt => {
        const aptDate = new Date(apt.date)
        const aptEndDate = new Date(aptDate.getTime() + apt.duration * 60000)
        const slotEndDate = new Date(slotDate.getTime() + serviceDuration * 60000)

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

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Erro ao buscar horários:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar horários' },
      { status: 500 }
    )
  }
}
