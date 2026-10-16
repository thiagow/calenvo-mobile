import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { addSchedulesToGroup, deleteBlockGroup } from '@/lib/schedule-blocks'

export const dynamic = 'force-dynamic'

// DELETE - Remove o bloqueio inteiro (todas as agendas do grupo). Idempotente: grupo
// inexistente, já removido — ou que não é do profissional que pede — devolve success com
// removed = 0. Profissional só remove os próprios; nunca o da agenda inteira nem de colega.
export async function DELETE(_request: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const removed = await deleteBlockGroup(prisma, {
      userId: scope.tenantId,
      groupId: params.groupId,
      professionalId: scope.professionalId
    })
    return NextResponse.json({ success: true, removed })
  } catch (error) {
    console.error('Error deleting schedule block group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Estende o bloqueio às agendas que ficaram de fora do grupo.
export async function POST(request: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const requested: unknown = body.scheduleIds
    if (
      !Array.isArray(requested) ||
      requested.length === 0 ||
      requested.some((id) => typeof id !== 'string' || !id)
    ) {
      return NextResponse.json({ error: 'Selecione ao menos uma agenda' }, { status: 400 })
    }

    const created = await addSchedulesToGroup(prisma, {
      userId: scope.tenantId,
      groupId: params.groupId,
      scheduleIds: Array.from(new Set(requested as string[])),
      viewerProfessionalId: scope.professionalId
    })
    if (created === null) {
      return NextResponse.json({ error: 'Bloqueio não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, schedulesCount: created })
  } catch (error) {
    console.error('Error extending schedule block group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
