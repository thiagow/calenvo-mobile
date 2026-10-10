
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { createBlocksFromRequest, describeBlock } from '@/lib/schedule-blocks'

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

    // Quantas agendas compartilham cada grupo (blocos criados via "todas as agendas")
    const groupIds = Array.from(new Set(blocks.map((b) => b.groupId).filter((g): g is string => Boolean(g))))
    const groupSizes = new Map<string, number>()
    if (groupIds.length > 0) {
      const grouped = await prisma.scheduleBlock.groupBy({
        by: ['groupId'],
        where: { groupId: { in: groupIds }, schedule: { userId } },
        _count: { _all: true },
      })
      for (const g of grouped) if (g.groupId) groupSizes.set(g.groupId, g._count._all)
    }

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId },
      select: { timezone: true }
    })
    const timeZone = businessConfig?.timezone || DEFAULT_TIMEZONE

    return NextResponse.json(
      blocks.map((b) => ({
        ...b,
        ...describeBlock(b, timeZone),
        groupSize: b.groupId ? groupSizes.get(b.groupId) ?? 1 : null
      }))
    )
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

    // Agendas-alvo: só esta, ou todas do tenant (inclusive inativas — se uma for
    // reativada depois, a data continua fechada).
    const applyToAll = Boolean(body.applyToAll)
    const targetSchedules = applyToAll
      ? await prisma.schedule.findMany({ where: { userId }, select: { id: true } })
      : [{ id: scheduleId }]

    const result = await createBlocksFromRequest({
      userId,
      scheduleIds: targetSchedules.map((s) => s.id),
      body,
      grouped: applyToAll
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('Error creating schedule block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
