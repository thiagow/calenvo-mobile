export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireFinance } from '@/lib/finance/guard'
import { paymentMethodCreateSchema, zodMessage } from '@/lib/finance/schemas'
import { financeErrorResponse, readJson } from '@/lib/finance/http'
import { PAYMENT_METHOD_SELECT } from '@/lib/finance/selects'

/**
 * GET /api/finance/payment-methods — qualquer usuário do tenant com o módulo
 * ligado (quem opera o caixa precisa da lista). `?all=1` inclui inativas (só MASTER).
 */
export async function GET(request: NextRequest) {
  const guard = await requireFinance()
  if (guard.error) return guard.error
  const includeInactive = guard.scope.isMaster && request.nextUrl.searchParams.get('all') === '1'

  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId: guard.scope.tenantId, ...(!includeInactive && { isActive: true }) },
      select: PAYMENT_METHOD_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    })
    return NextResponse.json({ paymentMethods })
  } catch (error) {
    return financeErrorResponse(error, 'payment_methods_list', guard.scope.tenantId)
  }
}

/** POST /api/finance/payment-methods — MASTER. */
export async function POST(request: NextRequest) {
  const guard = await requireFinance({ requireMaster: true })
  if (guard.error) return guard.error
  const { tenantId } = guard.scope

  const parsed = paymentMethodCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  try {
    const last = await prisma.paymentMethod.findFirst({
      where: { userId: tenantId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })
    const paymentMethod = await prisma.paymentMethod.create({
      data: { userId: tenantId, ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
      select: PAYMENT_METHOD_SELECT
    })
    return NextResponse.json({ paymentMethod }, { status: 201 })
  } catch (error) {
    return financeErrorResponse(error, 'payment_method_create', tenantId)
  }
}
