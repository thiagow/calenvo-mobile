export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireFinance } from '@/lib/finance/guard'
import { financeCategoryUpdateSchema, zodMessage } from '@/lib/finance/schemas'
import { financeErrorResponse, readJson } from '@/lib/finance/http'
import { FINANCE_CATEGORY_SELECT } from '@/lib/finance/selects'

/**
 * PATCH /api/finance/categories/[id] — MASTER. Categorias de sistema
 * (Serviços, Pacotes, Comissões) recebem os lançamentos automáticos: não
 * podem ser renomeadas nem desativadas.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireFinance({ requireMaster: true })
  if (guard.error) return guard.error
  const { tenantId } = guard.scope

  const parsed = financeCategoryUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  try {
    const existing = await prisma.financeCategory.findFirst({
      where: { id: params.id, userId: tenantId },
      select: { isSystem: true }
    })
    if (!existing) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Categorias do sistema recebem lançamentos automáticos e não podem ser alteradas' },
        { status: 409 }
      )
    }

    const category = await prisma.financeCategory.update({
      where: { id: params.id },
      data: parsed.data,
      select: FINANCE_CATEGORY_SELECT
    })
    return NextResponse.json({ category })
  } catch (error) {
    return financeErrorResponse(error, 'category_update', tenantId)
  }
}
