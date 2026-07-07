import crypto from 'crypto'
import { prisma } from '@/lib/db'

const TOKEN_PREFIX = 'cal_live_'

export interface GeneratedApiToken {
  token: string // texto puro — só existe neste momento, nunca é salvo
  tokenHash: string
  tokenPrefix: string
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateApiToken(): GeneratedApiToken {
  const raw = crypto.randomBytes(24).toString('hex')
  const token = `${TOKEN_PREFIX}${raw}`
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, TOKEN_PREFIX.length + 6),
  }
}

export interface ApiAuthContext {
  userId: string
  tokenId: string
  scopes: string[]
}

/**
 * Autentica uma requisição via `Authorization: Bearer <token>` contra a
 * tabela ApiToken. Retorna null se ausente, inválido ou revogado.
 */
export async function authenticateApiRequest(req: Request): Promise<ApiAuthContext | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null

  const tokenHash = hashToken(token)
  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash } })

  if (!apiToken || apiToken.revokedAt) return null

  // Fire-and-forget — não bloqueia a resposta por causa de uma atualização de telemetria.
  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch((error) => console.error('Erro ao atualizar lastUsedAt do ApiToken:', error))

  return { userId: apiToken.userId, tokenId: apiToken.id, scopes: apiToken.scopes }
}

export function hasScope(context: ApiAuthContext, scope: string): boolean {
  return context.scopes.includes(scope)
}
