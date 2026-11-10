export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireFinance } from '@/lib/finance/guard'
import { financeCategoryCreateSchema, zodMessage } from '@/lib/finance/schemas'
import { financeErrorResponse, readJson } from '@/lib/finance/http'
import { FINANCE_CATEGORY_SELECT } from '@/lib/finance/selects'

/** GET /api/finance/categories — `?kind=INCOME|EXPENSE`, `?all=1` inclui inativas (só MASTER). */
export async function GET(request: NextRequest) {
  const guard = await requireFinance()
  if (guard.error) return guard.error

  const kindParam = request.nextUrl.searchParams.get('kind')
  const kind = kindParam === 'INCOME' || kindParam === 'EXPENSE' ? kindParam : undefined
  const includeInactive = guard.scope.isMaster && request.nextUrl.searchParams.get('all') === '1'

  try {
    const categories = await prisma.financeCategory.findMany({
      where: {
        userId: guard.scope.tenantId,
        ...(kind && { kind }),
        ...(!includeInactive && { isActive: true })
      },
      select: FINANCE_CATEGORY_SELECT,
      orderBy: [{ kind: 'asc' }, { isSystem: 'desc' }, { name: 'asc' }]
    })
    return NextResponse.json({ categories })
  } catch (error) {
    return financeErrorResponse(error, 'categories_list', guard.scope.tenantId)
  }
}

/** POST /api/finance/categories — MASTER. */
export async function POST(request: NextRequest) {
  const guard = await requireFinance({ requireMaster: true })
  if (guard.error) return guard.error
  const { tenantId } = guard.scope

  const parsed = financeCategoryCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  try {
    const category = await prisma.financeCategory.create({
      data: { userId: tenantId, ...parsed.data },
      select: FINANCE_CATEGORY_SELECT
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    return financeErrorResponse(error, 'category_create', tenantId)
  }
}
