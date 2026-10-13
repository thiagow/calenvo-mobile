import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { resolveTenantScope, type TenantScope } from '@/lib/reactivation-service'

type ScopeResult = { scope: TenantScope; error?: never } | { scope?: never; error: NextResponse }

/**
 * Resolve o tenant da sessão (MASTER = ele mesmo; PROFESSIONAL = o master dele).
 * `requireMaster` devolve 403 para PROFESSIONAL — bloqueio no servidor, não só na UI.
 */
export async function getSessionScope({ requireMaster = false } = {}): Promise<ScopeResult> {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string; masterId?: string | null } | undefined
  if (!user?.id) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const scope = resolveTenantScope({ id: user.id, role: user.role, masterId: user.masterId })
  if (!scope) {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  if (requireMaster && !scope.isMaster) {
    return { error: NextResponse.json({ error: 'Apenas administradores podem realizar esta ação' }, { status: 403 }) }
  }

  return { scope }
}
