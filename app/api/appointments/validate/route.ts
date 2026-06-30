
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST - Validar se um horário está disponível antes de criar o agendamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scheduleId, professionalId, date, duration } = body

    if (!scheduleId || !date || !duration) {
      return NextResponse.json(
        { error: 'scheduleId, date e duration são obrigatórios' },
        { status: 400 }
      )
    }

    const appointmentDate = new Date(date)
    const appointmentEnd = new Date(appointmentDate.getTime() + duration * 60000)

    // Buscar conflitos
    const whereClause: any = {
      scheduleId: scheduleId,
      date: {
        lt: appointmentEnd // Data do agendamento existente é antes do fim do novo
      },
      status: {
        notIn: ['CANCELLED', 'NO_SHOW']
      }
    }

    // Se profissional específico, verificar apenas conflitos deste profissional
    if (professionalId) {
      whereClause.professionalId = professionalId
    }

    const conflictingAppointments = await prisma.appointment.findMany({
      where: whereClause,
      select: {
        date: true,
        duration: true
      }
    })

    // Verificar sobreposição
    const hasConflict = conflictingAppointments.some(appointment => {
      const existingStart = appointment.date
      const existingEnd = new Date(existingStart.getTime() + appointment.duration * 60000)
      
      // Há conflito se:
      // - Novo agendamento começa antes do fim do existente E
      // - Novo agendamento termina depois do início do existente
      return appointmentDate < existingEnd && appointmentEnd > existingStart
    })

    if (hasConflict) {
      return NextResponse.json({
        available: false,
        message: 'Já existe um agendamento neste horário para esta agenda e profissional'
      }, { status: 409 })
    }

    return NextResponse.json({
      available: true,
      message: 'Horário disponível'
    })
  } catch (error) {
    console.error('Error validating appointment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
