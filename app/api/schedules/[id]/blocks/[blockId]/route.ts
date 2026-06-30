
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

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

    await prisma.scheduleBlock.delete({
      where: { id: blockId }
    })

    return NextResponse.json({ success: true })
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
    const { startDate, endDate, reason, isAllDay } = body

    // Validar que endDate > startDate
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { error: 'Data de fim deve ser posterior à data de início' },
        { status: 400 }
      )
    }

    const block = await prisma.scheduleBlock.update({
      where: { id: blockId },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(reason !== undefined && { reason }),
        ...(isAllDay !== undefined && { isAllDay })
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
