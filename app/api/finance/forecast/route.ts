export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json } from '@/lib/finance/route'
import { badRequest } from '@/lib/finance/errors'
import { loadForecast } from '@/lib/finance/forecast'

const ALLOWED_DAYS = [7, 14, 30, 60, 90]

/** GET /api/finance/forecast?days=30 — MASTER. Previsão de recebimento pela agenda e pelos recebíveis em aberto. */
export const GET = financeRoute({ requireMaster: true }, 'forecast', async ({ scope }, request) => {
  const days = Number(request.nextUrl.searchParams.get('days') ?? 30)
  if (!ALLOWED_DAYS.includes(days)) throw badRequest('Período inválido (use 7, 14, 30, 60 ou 90 dias)')
  return json(await inTransaction((tx) => loadForecast(tx, scope.tenantId, days)))
})
