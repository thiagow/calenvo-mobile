
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Buscar horários disponíveis para uma data específica
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('scheduleId')
    const professionalId = searchParams.get('professionalId')
    const serviceId = searchParams.get('serviceId') // NOVO: ID do serviço selecionado
    const date = searchParams.get('date') // Format: YYYY-MM-DD

    if (!scheduleId || !date) {
      return NextResponse.json(
        { error: 'scheduleId e date são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar a agenda com configurações de dia
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        OR: [
          { userId: userId }, // Agenda do master
          { 
            professionals: {
              some: {
                professionalId: userId // Agenda onde é profissional
              }
            }
          }
        ],
        isActive: true
      },
      include: {
        dayConfigs: true, // Incluir configurações customizadas por dia
        blocks: true // Incluir bloqueios
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // NOVO: Buscar o serviço selecionado para obter a duração
    let serviceDuration = schedule.slotDuration // Duração padrão
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: {
          id: serviceId,
          userId: userId,
          isActive: true
        }
      })
      
      if (service) {
        serviceDuration = service.duration
      }
    }

    // Verificar se a data está dentro do período permitido
    const selectedDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Verificar dia da semana
    const dayOfWeek = selectedDate.getDay()
    
    // NOVO: Verificar se usa configuração customizada por dia
    let dayConfig = null
    if (schedule.useCustomDayConfig) {
      dayConfig = schedule.dayConfigs.find((config: any) => config.dayOfWeek === dayOfWeek)
      
      // Se não tem configuração para este dia ou está inativo
      if (!dayConfig || !dayConfig.isActive) {
        return NextResponse.json({ 
          slots: [],
          message: 'Este dia não está disponível na agenda'
        })
      }
    } else {
      // Usar configuração padrão
      if (!schedule.workingDays.includes(dayOfWeek)) {
        return NextResponse.json({ 
          slots: [],
          message: 'Este dia não está disponível na agenda'
        })
      }
    }

    // Verificar se há bloqueios para esta data
    const selectedDateStart = new Date(selectedDate)
    selectedDateStart.setHours(0, 0, 0, 0)
    const selectedDateEnd = new Date(selectedDate)
    selectedDateEnd.setHours(23, 59, 59, 999)
    
    const hasBlock = schedule.blocks.some((block: any) => {
      const blockStart = new Date(block.startDate)
      const blockEnd = new Date(block.endDate)
      
      return (
        (blockStart <= selectedDateEnd && blockEnd >= selectedDateStart) &&
        block.isAllDay
      )
    })
    
    if (hasBlock) {
      return NextResponse.json({ 
        slots: [],
        message: 'Este dia está bloqueado'
      })
    }

    // Verificar se está dentro do período de antecedência
    const minDate = new Date()
    minDate.setHours(minDate.getHours() + schedule.minNoticeHours)
    
    if (selectedDate < minDate) {
      return NextResponse.json({ 
        slots: [],
        message: `É necessário agendar com pelo menos ${schedule.minNoticeHours} horas de antecedência`
      })
    }

    // Verificar se não excede o período máximo
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + schedule.advanceBookingDays)
    
    if (selectedDate > maxDate) {
      return NextResponse.json({ 
        slots: [],
        message: `Agendamentos só podem ser feitos com até ${schedule.advanceBookingDays} dias de antecedência`
      })
    }

    // ATUALIZADO: Gerar todos os slots possíveis considerando duração do serviço + intervalo
    // Os slots são espaçados pela duração do serviço + bufferTime (intervalo)
    const slotInterval = serviceDuration + schedule.bufferTime
    
    let allSlots: { time: string, label: string }[] = []
    
    if (dayConfig && dayConfig.timeSlots) {
      // Usar horários customizados do dia específico
      const timeSlots = dayConfig.timeSlots as any[]
      
      for (const slot of timeSlots) {
        const slotsForRange = generateTimeSlots(
          slot.startTime,
          slot.endTime,
          slotInterval,
          undefined, // Não usar lunchStart/End quando tem configuração customizada
          undefined
        )
        allSlots = [...allSlots, ...slotsForRange]
      }
    } else {
      // Usar horários padrão da agenda
      allSlots = generateTimeSlots(
        schedule.startTime,
        schedule.endTime,
        slotInterval,
        schedule.lunchStart || undefined,
        schedule.lunchEnd || undefined
      )
    }

    // Buscar agendamentos existentes para este dia, agenda e profissional (se especificado)
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

    const whereClause: any = {
      scheduleId: scheduleId,
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: {
        notIn: ['CANCELLED', 'NO_SHOW'] // Ignorar agendamentos cancelados
      }
    }

    // Se um profissional específico foi selecionado, filtrar por ele
    if (professionalId) {
      whereClause.professionalId = professionalId
    }

    const existingAppointments = await prisma.appointment.findMany({
      where: whereClause,
      select: {
        date: true,
        duration: true
      }
    })

    // Marcar slots ocupados
    const availableSlots = allSlots.map(slot => {
      const slotTime = parseTimeToMinutes(slot.time)
      
      const isOccupied = existingAppointments.some(appointment => {
        const appointmentStart = appointment.date.getHours() * 60 + appointment.date.getMinutes()
        const appointmentEnd = appointmentStart + appointment.duration
        
        // ATUALIZADO: Verificar se há sobreposição considerando a duração do serviço selecionado
        return slotTime < appointmentEnd && (slotTime + serviceDuration) > appointmentStart
      })

      return {
        ...slot,
        available: !isOccupied
      }
    })

    return NextResponse.json({
      slots: availableSlots,
      schedule: {
        name: schedule.name,
        slotDuration: serviceDuration, // Retornar a duração do serviço selecionado
        bufferTime: schedule.bufferTime
      }
    })
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper: Gerar slots de tempo
// IMPORTANTE: Esta função agora processa múltiplos períodos separadamente
// e valida se o atendimento completo cabe dentro de cada período
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  lunchStart?: string,
  lunchEnd?: string
): { time: string, label: string }[] {
  const slots: { time: string, label: string }[] = []
  
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const lunchStartMinutes = lunchStart ? parseTimeToMinutes(lunchStart) : null
  const lunchEndMinutes = lunchEnd ? parseTimeToMinutes(lunchEnd) : null
  
  // Dividir em períodos separados se houver horário de almoço
  const periods: Array<{ start: number, end: number }> = []
  
  if (lunchStartMinutes !== null && lunchEndMinutes !== null && 
      lunchStartMinutes > startMinutes && lunchEndMinutes < endMinutes) {
    // Há intervalo de almoço válido - criar dois períodos
    periods.push(
      { start: startMinutes, end: lunchStartMinutes },  // Período da manhã
      { start: lunchEndMinutes, end: endMinutes }       // Período da tarde
    )
  } else {
    // Sem intervalo de almoço - período único
    periods.push({ start: startMinutes, end: endMinutes })
  }
  
  // Processar cada período separadamente
  for (const period of periods) {
    let currentTime = period.start
    
    // Gerar slots enquanto o ATENDIMENTO COMPLETO couber no período
    while (currentTime + duration <= period.end) {
      const time = formatMinutesToTime(currentTime)
      slots.push({
        time,
        label: time
      })
      
      // Avançar para o próximo slot (início + duração do serviço)
      currentTime += duration
    }
  }
  
  return slots
}

// Helper: Converter "HH:MM" para minutos
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Helper: Converter minutos para "HH:MM"
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
