import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { createBlocksFromRequest, describeBlock, isBlockPast } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

// GET - Listar bloqueios de uma agenda
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const scheduleId = params.id

    // A agenda precisa ser do tenant (e, para profissional, estar vinculada a ele)
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: scope.tenantId,
        ...(scope.professionalId && { professionals: { some: { professionalId: scope.professionalId } } })
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Profissional enxerga o que o afeta: bloqueios da agenda inteira e os próprios
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        scheduleId,
        ...(scope.professionalId && { OR: [{ professionalId: null }, { professionalId: scope.professionalId }] })
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    // Quantas agendas compartilham cada grupo (blocos criados para várias agendas)
    const groupIds = Array.from(new Set(blocks.map((b) => b.groupId).filter((g): g is string => Boolean(g))))
    const groupSizes = new Map<string, number>()
    if (groupIds.length > 0) {
      const grouped = await prisma.scheduleBlock.groupBy({
        by: ['groupId'],
        where: { groupId: { in: groupIds }, schedule: { userId: scope.tenantId } },
        _count: { _all: true },
      })
      for (const g of grouped) if (g.groupId) groupSizes.set(g.groupId, g._count._all)
    }

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId: scope.tenantId },
      select: { timezone: true }
    })
    const timeZone = businessConfig?.timezone || DEFAULT_TIMEZONE
    const now = new Date()

    // Bloqueio "geral" (2+ agendas) e o pessoal de profissional são gerenciados no diálogo de
    // bloqueios (Agendas → Bloqueios gerais; para o profissional, Meus bloqueios). Aqui entram só
    // os desta agenda. Grupo comum que sobrou com 1 bloco volta a ser da agenda.
    const isGeneral = (b: (typeof blocks)[number]) =>
      Boolean(b.professionalId) || (Boolean(b.groupId) && (groupSizes.get(b.groupId!) ?? 1) > 1)
    const own = blocks.filter((b) => !isGeneral(b))
    const general = blocks.filter(isGeneral)

    return NextResponse.json({
      blocks: own.map((b) => ({
        ...b,
        ...describeBlock(b, timeZone),
        isPast: isBlockPast(b, timeZone, now),
        groupId: null,
        // Profissional vê o bloqueio da agenda inteira (explica o dia fechado), mas não o remove.
        canManage: scope.isMaster
      })),
      // Gerais/pessoais que ainda valem e também fecham esta agenda (o aviso explica o "dia fechado sem bloqueio aqui").
      generalBlocksCount: new Set(general.filter((b) => !isBlockPast(b, timeZone, now)).map((b) => b.groupId ?? b.id)).size
    })
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
    const { scope, error } = await getSessionScope()
    if (error) return error

    const scheduleId = params.id

    // Verificar se a agenda pertence ao tenant (profissional: e está vinculado a ela)
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: scope.tenantId,
        ...(scope.professionalId && { professionals: { some: { professionalId: scope.professionalId } } })
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    const body = await request.json()

    // Agendas-alvo: só esta, ou todas do tenant (inclusive inativas — se uma for
    // reativada depois, a data continua fechada). Profissional: todas as dele.
    const applyToAll = Boolean(body.applyToAll)
    const targetSchedules = applyToAll
      ? await prisma.schedule.findMany({
          where: {
            userId: scope.tenantId,
            ...(scope.professionalId && { professionals: { some: { professionalId: scope.professionalId } } })
          },
          select: { id: true }
        })
      : [{ id: scheduleId }]

    const result = await createBlocksFromRequest({
      userId: scope.tenantId,
      scheduleIds: targetSchedules.map((s) => s.id),
      body,
      grouped: applyToAll,
      professionalId: scope.professionalId
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
