
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { createBlocks, findAppointmentsInBlockRange } from '@/lib/schedule-blocks'

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

    return NextResponse.json(
      blocks.map((b) => ({ ...b, groupSize: b.groupId ? groupSizes.get(b.groupId) ?? 1 : null }))
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
    const { startDate, endDate, reason, isAllDay, applyToAll, confirmConflicts } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Data de início e fim são obrigatórias' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    }

    // Validar que endDate > startDate
    if (end <= start) {
      return NextResponse.json(
        { error: 'Data de fim deve ser posterior à data de início' },
        { status: 400 }
      )
    }

    // Agendas-alvo: só esta, ou todas do tenant (inclusive inativas — se uma for
    // reativada depois, a data continua fechada).
    const targetSchedules = applyToAll
      ? await prisma.schedule.findMany({ where: { userId }, select: { id: true } })
      : [{ id: scheduleId }]
    const scheduleIds = targetSchedules.map((s) => s.id)

    // Agendamentos que já existem no período: o bloqueio NUNCA os altera, mas o
    // dono precisa saber antes de concluir. Aviso imposto aqui no servidor —
    // sem confirmação explícita, nada é criado.
    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId },
      select: { timezone: true }
    })
    const conflicts = await findAppointmentsInBlockRange(prisma, {
      userId,
      scheduleIds,
      startDate: start,
      endDate: end,
      timeZone: businessConfig?.timezone || DEFAULT_TIMEZONE
    })

    if (conflicts.length > 0 && confirmConflicts !== true) {
      return NextResponse.json(
        {
          error: `Já existem ${conflicts.length} agendamento(s) neste período`,
          code: 'BLOCK_HAS_APPOINTMENTS',
          conflictingAppointments: conflicts.length,
          schedulesCount: scheduleIds.length,
          sample: conflicts.slice(0, 5).map((c) => ({
            date: c.date,
            clientName: c.clientName,
            serviceName: c.serviceName
          }))
        },
        { status: 409 }
      )
    }

    const { count, groupId } = await createBlocks(prisma, {
      scheduleIds,
      startDate: start,
      endDate: end,
      reason: reason || null,
      isAllDay: isAllDay !== undefined ? isAllDay : true,
      grouped: Boolean(applyToAll)
    })

    return NextResponse.json(
      { success: true, schedulesCount: count, groupId, conflictingAppointments: conflicts.length },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating schedule block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
