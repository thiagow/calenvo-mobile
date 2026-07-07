import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

// Rate limiting é opcional até UPSTASH_REDIS_REST_URL/TOKEN serem configurados.
// Sem essas variáveis, as requisições passam direto (com um aviso no log) em vez
// de derrubar a API pública — evita acoplar o lançamento da API a uma conta Upstash.
const ratelimit = upstashUrl && upstashToken
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl, token: upstashToken }),
      limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requisições/minuto por token
      prefix: 'calenvo:api',
    })
  : null

if (!ratelimit) {
  console.warn('⚠️ UPSTASH_REDIS_REST_URL/TOKEN não configurados — rate limiting da API pública está desativado')
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  const result = await ratelimit.limit(identifier)
  return result
}
