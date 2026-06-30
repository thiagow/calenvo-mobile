
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar bloqueios de uma agenda
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const scheduleId = params.id

    // Verificar se a agenda pertence ao usuário
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: userId
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Buscar bloqueios
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        scheduleId: scheduleId
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    return NextResponse.json(blocks)
  } catch (error) {
    console.error('Error fetching schedule blocks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Criar novo bloqueio
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const scheduleId = params.id

    // Verificar se a agenda pertence ao usuário
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: userId
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { startDate, endDate, reason, isAllDay } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Data de início e fim são obrigatórias' },
        { status: 400 }
      )
    }

    // Validar que endDate > startDate
    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { error: 'Data de fim deve ser posterior à data de início' },
        { status: 400 }
      )
    }

    const block = await prisma.scheduleBlock.create({
      data: {
        scheduleId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || null,
        isAllDay: isAllDay !== undefined ? isAllDay : true
      }
    })

    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
