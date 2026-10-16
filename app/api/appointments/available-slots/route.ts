
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getAvailableSlots, getNoSlotsReason } from '@/lib/availability-service'

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
    const serviceId = searchParams.get('serviceId')
    const date = searchParams.get('date')

    if (!scheduleId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'scheduleId, serviceId e date são obrigatórios' },
        { status: 400 }
      )
    }

    // Master vê suas próprias agendas; profissional vê as agendas onde está vinculado.
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        isActive: true,
        OR: [
          { userId },
          { professionals: { some: { professionalId: userId } } }
        ]
      },
      select: { userId: true }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Tela interna do painel: a antecedência máxima é regra do cliente final (página
    // pública e chat). Quem agenda pelo painel (telefone, balcão) marca além dela — a
    // criação nunca a bloqueou, só esta grade.
    const slotParams = {
      scheduleId,
      date,
      userId: schedule.userId,
      ignoreAdvanceWindow: true,
      ...(professionalId && { professionalId }),
    }
    const slots = await getAvailableSlots({ ...slotParams, serviceId })

    if (slots === null) {
      return NextResponse.json({ error: 'Agenda ou serviço não encontrado' }, { status: 404 })
    }

    // Sem horário livre: diz o motivo (dia bloqueado, agenda não atende, tudo ocupado...)
    const reason = await getNoSlotsReason({ ...slotParams, slots })

    return NextResponse.json({ slots, reason })
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
