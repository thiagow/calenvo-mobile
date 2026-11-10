import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/error-logger'

/** Resposta padrão de erro das rotas do financeiro. */
export function financeErrorResponse(error: unknown, functionality: string, userId?: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ error: 'Já existe um registro com esse nome' }, { status: 409 })
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
