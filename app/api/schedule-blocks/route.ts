import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { createBlocksFromRequest } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

// POST - Criar o mesmo bloqueio em várias agendas do tenant (ou em todas)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const body = await request.json()
    const requested: unknown = body.scheduleIds
    if (
      !Array.isArray(requested) ||
      requested.length === 0 ||
      requested.some((id) => typeof id !== 'string' || !id)
    ) {
      return NextResponse.json({ error: 'Selecione ao menos uma agenda' }, { status: 400 })
    }
    const scheduleIds = Array.from(new Set(requested as string[]))

    // Todas as agendas pedidas precisam ser do tenant — qualquer id alheio
    // recusa o pedido inteiro, sem criar nada.
    const owned = await prisma.schedule.findMany({
      where: { userId, id: { in: scheduleIds } },
      select: { id: true }
    })
    if (owned.length !== scheduleIds.length) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    const result = await createBlocksFromRequest({
      userId,
      scheduleIds,
      body,
      grouped: scheduleIds.length > 1
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('Error creating schedule blocks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
