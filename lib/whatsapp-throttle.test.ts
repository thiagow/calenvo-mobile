import { describe, it, expect, vi, afterEach } from 'vitest'
import { randomStepMs, msToQstashDelay } from '@/lib/whatsapp-throttle'

describe('randomStepMs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fica sempre dentro de [1000, 4000)', () => {
    for (let i = 0; i < 200; i++) {
      const step = randomStepMs()
      expect(step).toBeGreaterThanOrEqual(1000)
      expect(step).toBeLessThan(4000)
    }
  })

  it('não é um valor fixo — gera passos diferentes entre chamadas', () => {
    const steps = new Set(Array.from({ length: 50 }, () => randomStepMs()))
    expect(steps.size).toBeGreaterThan(1)
  })
})

describe('msToQstashDelay', () => {
  it('formata milissegundos como string de segundos aceita pelo QStash', () => {
    expect(msToQstashDelay(3000)).toBe('3s')
    expect(msToQstashDelay(3499)).toBe('3s')
    expect(msToQstashDelay(3500)).toBe('4s')
  })

  it('nunca retorna menos que 1s, mesmo com delay quase zero', () => {
    expect(msToQstashDelay(0)).toBe('1s')
    expect(msToQstashDelay(200)).toBe('1s')
  })
})
