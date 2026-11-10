import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/error-logger'
import { FinanceError } from './errors'

/** Resposta padrão de erro das rotas do financeiro. */
export function financeErrorResponse(error: unknown, functionality: string, userId?: string) {
  if (error instanceof FinanceError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '')
    if (target.includes('one_open_per_tenant')) {
      return NextResponse.json({ error: 'Já existe um caixa aberto' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Já existe um registro com esses dados' }, { status: 409 })
  }
  console.error(`[finance] ${functionality} failed:`, error)
  void logError({ functionality: `finance_${functionality}`, error, userId })
  return NextResponse.json({ error: 'Erro interno no módulo financeiro' }, { status: 500 })
}

/** Lê o JSON do corpo sem estourar 500 em corpo inválido. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Data de query string (YYYY-MM-DD ou ISO); null se ausente ou inválida. */
export function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
