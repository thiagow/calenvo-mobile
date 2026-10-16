import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { createBlocksFromRequest, listGeneralBlocks } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

// GET - Bloqueios gerais (2+ agendas) e pessoais de profissionais, um item por grupo.
// Administrador vê e gerencia tudo; profissional vê os da agenda inteira e os próprios,
// e só gerencia os próprios (`canManage`).
export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId: scope.tenantId },
      select: { timezone: true }
    })
    const groups = await listGeneralBlocks(prisma, {
      userId: scope.tenantId,
      timeZone: businessConfig?.timezone || DEFAULT_TIMEZONE,
      viewerProfessionalId: scope.professionalId
    })
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error listing general schedule blocks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Criar o mesmo bloqueio em várias agendas do tenant (ou em todas).
// Autor profissional: o bloqueio é pessoal (fecha só ele) e só nas agendas em que está vinculado.
export async function POST(request: NextRequest) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

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

    // Todas as agendas pedidas precisam ser do tenant (e, para profissional, estar
    // vinculadas a ele) — qualquer id alheio recusa o pedido inteiro, sem criar nada.
    const owned = await prisma.schedule.findMany({
      where: {
        userId: scope.tenantId,
        id: { in: scheduleIds },
        ...(scope.professionalId && { professionals: { some: { professionalId: scope.professionalId } } })
      },
      select: { id: true }
    })
    if (owned.length !== scheduleIds.length) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    const result = await createBlocksFromRequest({
      userId: scope.tenantId,
      scheduleIds,
      body,
      grouped: scheduleIds.length > 1,
      professionalId: scope.professionalId
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('Error creating schedule blocks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
