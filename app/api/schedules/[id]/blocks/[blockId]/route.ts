
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { deleteBlockGroup, parseBlockInput } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

// DELETE - Remover bloqueio
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id: scheduleId, blockId } = params

    // Verificar se o bloqueio existe e pertence a uma agenda do usuário
    const block = await prisma.scheduleBlock.findFirst({
      where: {
        id: blockId,
        scheduleId: scheduleId,
        schedule: {
          userId: userId
        }
      }
    })

    if (!block) {
      return NextResponse.json({ error: 'Bloqueio não encontrado' }, { status: 404 })
    }

    // `?scope=all` remove o grupo inteiro (blocos criados via "todas as agendas").
    // Sem isso, só este bloco — comportamento anterior.
    const removeWholeGroup =
      request.nextUrl.searchParams.get('scope') === 'all' && Boolean(block.groupId)

    if (removeWholeGroup) {
      const removed = await deleteBlockGroup(prisma, { userId, groupId: block.groupId! })
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
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id: scheduleId, blockId } = params

    // Verificar se o bloqueio existe e pertence a uma agenda do usuário
    const existingBlock = await prisma.scheduleBlock.findFirst({
      where: {
        id: blockId,
        scheduleId: scheduleId,
        schedule: {
          userId: userId
        }
      }
    })

    if (!existingBlock) {
      return NextResponse.json({ error: 'Bloqueio não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { reason } = body

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId },
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
