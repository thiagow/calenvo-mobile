
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { checkBookingConflict } from '@/lib/appointment-service'
import { DEFAULT_TIMEZONE, wallTimeToInstant } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

// POST - Validar se um horário está disponível antes de criar o agendamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { scheduleId, professionalId, date, time, duration } = body

    if (!scheduleId || !date || !duration) {
      return NextResponse.json(
        { error: 'scheduleId, date e duration são obrigatórios' },
        { status: 400 }
      )
    }

    // Confirma que a agenda pertence ao tenant da sessão antes de expor
    // ocupação — sem isso, qualquer usuário autenticado conseguia sondar a
    // agenda de outro tenant só adivinhando/vazando um scheduleId.
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
      select: { id: true, user: { select: { businessConfig: { select: { timezone: true } } } } }
    })
    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Mesma conversão da escrita — a sonda tem que perguntar exatamente sobre o
    // instante que o POST vai gravar, senão volta a divergir da criação.
    const timezone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE
    const appointmentDate = time ? wallTimeToInstant(date, time, timezone) : new Date(date)
    if (Number.isNaN(appointmentDate.getTime())) {
      return NextResponse.json({ error: 'Data ou horário inválido' }, { status: 400 })
    }

    const hasConflict = await checkBookingConflict({
      scheduleId,
      professionalId: professionalId || null,
      date: appointmentDate,
      duration
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
