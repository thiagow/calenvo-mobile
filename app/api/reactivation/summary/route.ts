export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionScope } from '@/lib/session-scope'
import { countByBucket, listReactivationItems } from '@/lib/reactivation-service'

/** Só os contadores — para o card do dashboard e o badge da navegação. */
export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const counts = countByBucket(await listReactivationItems(scope))
    return NextResponse.json({ counts })
  } catch (error) {
    console.error('[reactivation] summary failed:', error)
    return NextResponse.json({ error: 'Erro ao carregar resumo de retorno' }, { status: 500 })
  }
}
