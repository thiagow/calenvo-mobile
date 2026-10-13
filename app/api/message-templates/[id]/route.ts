export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { TEMPLATE_SELECT, updateTemplateSchema } from '../schema'

type Params = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { scope, error } = await getSessionScope({ requireMaster: true })
    if (error) return error

    const parsed = updateTemplateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const owned = await prisma.messageTemplate.findFirst({
      where: { id: params.id, userId: scope.tenantId },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })

    const template = await prisma.$transaction(async tx => {
      if (parsed.data.isDefault) {
        await tx.messageTemplate.updateMany({
          where: { userId: scope.tenantId, kind: 'REACTIVATION', isDefault: true, NOT: { id: params.id } },
          data: { isDefault: false },
        })
      }
      return tx.messageTemplate.update({ where: { id: params.id }, data: parsed.data, select: TEMPLATE_SELECT })
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[message-templates] PATCH failed:', error)
    return NextResponse.json({ error: 'Erro ao salvar modelo' }, { status: 500 })
  }
}

/**
 * Excluir o modelo padrão promove automaticamente o mais recente dos restantes —
 * o tenant nunca fica sem padrão enquanto tiver algum modelo. Serviços que
 * apontavam para ele voltam a usar o padrão (FK com onDelete: SetNull).
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { scope, error } = await getSessionScope({ requireMaster: true })
    if (error) return error

    const target = await prisma.messageTemplate.findFirst({
      where: { id: params.id, userId: scope.tenantId },
      select: { id: true, isDefault: true, kind: true },
    })
    if (!target) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })

    await prisma.$transaction(async tx => {
      await tx.messageTemplate.delete({ where: { id: target.id } })
      if (!target.isDefault) return
      const next = await tx.messageTemplate.findFirst({
        where: { userId: scope.tenantId, kind: target.kind },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (next) await tx.messageTemplate.update({ where: { id: next.id }, data: { isDefault: true } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[message-templates] DELETE failed:', error)
    return NextResponse.json({ error: 'Erro ao excluir modelo' }, { status: 500 })
  }
}
