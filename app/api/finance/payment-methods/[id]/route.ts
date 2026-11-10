export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireFinance } from '@/lib/finance/guard'
import { paymentMethodUpdateSchema, zodMessage } from '@/lib/finance/schemas'
import { financeErrorResponse, readJson } from '@/lib/finance/http'
import { PAYMENT_METHOD_SELECT } from '@/lib/finance/selects'

/**
 * PATCH /api/finance/payment-methods/[id] — MASTER. Não existe DELETE: os
 * lançamentos apontam para a forma de pagamento; desativar com `isActive`.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireFinance({ requireMaster: true })
  if (guard.error) return guard.error
  const { tenantId } = guard.scope

  const parsed = paymentMethodUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  try {
    // updateMany com userId garante o escopo do tenant numa única ida ao banco.
    const { count } = await prisma.paymentMethod.updateMany({
      where: { id: params.id, userId: tenantId },
      data: parsed.data
    })
    if (count === 0) return NextResponse.json({ error: 'Forma de pagamento não encontrada' }, { status: 404 })

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: params.id },
      select: PAYMENT_METHOD_SELECT
    })
    return NextResponse.json({ paymentMethod })
  } catch (error) {
    return financeErrorResponse(error, 'payment_method_update', tenantId)
  }
}
