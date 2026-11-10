import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { prisma } from '@/lib/db'
import type { TenantScope } from '@/lib/reactivation-service'
import { requireFinance } from './guard'
import { badRequest } from './errors'
import { financeErrorResponse, readJson } from './http'
import { zodMessage } from './schemas'
import type { Tx } from './context'
import type { FinanceStatus } from './status'

export interface FinanceRouteContext {
  scope: TenantScope
  status: FinanceStatus
  actorId: string
  canOperateCash: boolean
}

type Params = Record<string, string>

/**
 * Adaptador das rotas do financeiro: guard (auth → direito de uso → módulo
 * ligado → papel) e tradução de erros. A lógica fica no handler.
 */
export function financeRoute<P extends Params = Params>(
  options: Parameters<typeof requireFinance>[0],
  functionality: string,
  handler: (ctx: FinanceRouteContext, request: NextRequest, params: P) => Promise<Response>
) {
  return async (request: NextRequest, context: { params: P }) => {
    const guard = await requireFinance(options)
    if (guard.error) return guard.error
    try {
      return await handler(guard, request, context?.params ?? ({} as P))
    } catch (error) {
      return financeErrorResponse(error, functionality, guard.scope.tenantId)
    }
  }
}

export async function parseBody<S extends z.ZodTypeAny>(request: NextRequest, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readJson(request))
  if (!parsed.success) throw badRequest(zodMessage(parsed.error))
  return parsed.data
}

/** Transação com isolamento padrão e timeout folgado para operações com vários lançamentos. */
export function inTransaction<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(fn, { timeout: 15_000, maxWait: 5_000 })
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
