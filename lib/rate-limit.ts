import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null

if (!redis) {
  console.warn('⚠️ UPSTASH_REDIS_REST_URL/TOKEN não configurados — rate limiting da API pública está desativado')
}

export type RateLimitTier = 'default' | 'public'

// 'default': 60/min — endpoints autenticados/internos (comportamento original).
// 'public': 30/min — páginas e endpoints sem autenticação vistos por clientes finais
// (ex.: página de confirmação de agendamento via link de WhatsApp).
const TIER_CONFIG: Record<RateLimitTier, { limit: number; window: string }> = {
  default: { limit: 60, window: '1 m' },
  public: { limit: 30, window: '1 m' },
}

const limiters = new Map<RateLimitTier, Ratelimit>()

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  if (!redis) return null
  let limiter = limiters.get(tier)
  if (!limiter) {
    const { limit, window } = TIER_CONFIG[tier]
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
      prefix: `calenvo:${tier}`,
    })
    limiters.set(tier, limiter)
  }
  return limiter
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// `failClosed: true` bloqueia a requisição quando o Upstash não está configurado, em vez
// de deixar passar. Usar em rotas públicas e não autenticadas onde tráfego sem limite vira
// custo direto da plataforma (ex.: chat do widget, que chama a OpenAI a cada request).
export async function checkRateLimit(
  identifier: string,
  options?: { failClosed?: boolean; tier?: RateLimitTier }
): Promise<RateLimitResult> {
  const limiter = getLimiter(options?.tier || 'default')
  if (!limiter) {
    return { success: !options?.failClosed, limit: 0, remaining: 0, reset: 0 }
  }

  const result = await limiter.limit(identifier)
  return result
}
