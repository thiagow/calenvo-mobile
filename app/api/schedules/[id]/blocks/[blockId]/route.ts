import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { deleteBlockGroup, parseBlockInput } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

const FORBIDDEN = 'Você só pode alterar os seus próprios bloqueios'

// DELETE - Remover bloqueio
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const { id: scheduleId, blockId } = params

    // Verificar se o bloqueio existe e pertence a uma agenda do tenant
    const block = await prisma.scheduleBlock.findFirst({
      where: {
        id: blockId,
        scheduleId: scheduleId,
        schedule: {
          userId: scope.tenantId
        }
      }
    })

    if (!block) {
      return NextResponse.json({ error: 'Bloqueio não encontrado' }, { status: 404 })
    }

    // Profissional só remove o que é dele; bloqueio da agenda inteira ou de colega é do administrador.
    if (scope.professionalId && block.professionalId !== scope.professionalId) {
      return NextResponse.json({ error: FORBIDDEN }, { status: 403 })
    }

    // `?scope=all` remove o grupo inteiro (blocos criados para várias agendas).
    // Sem isso, só este bloco — comportamento anterior.
    const removeWholeGroup =
      request.nextUrl.searchParams.get('scope') === 'all' && Boolean(block.groupId)

    if (removeWholeGroup) {
      const removed = await deleteBlockGroup(prisma, {
        userId: scope.tenantId,
        groupId: block.groupId!,
        professionalId: scope.professionalId
      })
      return NextResponse.json({ success: true, removed })
    }

    await prisma.scheduleBlock.delete({
      where: { id: blockId }
    })

    return NextResponse.json({ success: true, removed: 1 })
  } catch (error) {
    console.error('Error deleting schedule block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar bloqueio
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const { id: scheduleId, blockId } = params

    // Verificar se o bloqueio existe e pertence a uma agenda do tenant
    const existingBlock = await prisma.scheduleBlock.findFirst({
      where: {
        id: blockId,
        scheduleId: scheduleId,
        schedule: {
          userId: scope.tenantId
        }
      }
    })

    if (!existingBlock) {
      return NextResponse.json({ error: 'Bloqueio não encontrado' }, { status: 404 })
    }

    if (scope.professionalId && existingBlock.professionalId !== scope.professionalId) {
      return NextResponse.json({ error: FORBIDDEN }, { status: 403 })
    }

    // Bloco de um grupo editado sozinho se desalinha dos irmãos: bloqueio de várias
    // agendas só se remove e recria (Agendas → Bloqueios gerais).
    if (existingBlock.groupId) {
      const siblings = await prisma.scheduleBlock.count({
        where: { groupId: existingBlock.groupId, schedule: { userId: scope.tenantId } }
      })
      if (siblings > 1) {
        return NextResponse.json(
          { error: 'Bloqueio de várias agendas não pode ser editado individualmente. Remova e crie de novo.' },
          { status: 409 }
        )
      }
    }

    const body = await request.json()
    const { reason } = body

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId: scope.tenantId },
      select: { timezone: true }
    })
    const parsed = parseBlockInput(body, businessConfig?.timezone || DEFAULT_TIMEZONE)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const block = await prisma.scheduleBlock.update({
      where: { id: blockId },
      data: {
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isAllDay: parsed.isAllDay,
        ...(reason !== undefined && { reason })
      }
    })

    return NextResponse.json(block)
  } catch (error) {
    console.error('Error updating schedule block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
