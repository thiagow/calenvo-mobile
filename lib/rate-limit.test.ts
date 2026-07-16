import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regressão para o P0 do widget de chat: sem Upstash configurado, uma rota
// pública não autenticada deve falhar FECHADO (bloquear), nunca aberto —
// tráfego sem limite ali vira fatura de OpenAI da plataforma. A API
// autenticada continua fail-open (comportamento histórico, deliberado).
describe('checkRateLimit sem Upstash configurado', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  })

  it('failClosed: true bloqueia a requisição', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit('widget:test-tenant', { failClosed: true })
    expect(result.success).toBe(false)
  })

  it('sem failClosed (rota autenticada) deixa passar', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit('api-token:test')
    expect(result.success).toBe(true)
  })
})
