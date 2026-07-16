import { describe, it, expect } from 'vitest'
import { STRIPE_PRICE_IDS, getStripePriceId, getPlanFromPriceId } from '@/lib/stripe'
import { PlanType } from '@prisma/client'
import type { Currency } from '@/lib/types'
import type { BillingInterval } from '@/lib/stripe'

// Estas asserções existem para pegar regressão no mapeamento de cobrança:
// um Price ID errado ou faltando cobra o cliente errado ou trava o checkout.
// Precisam rodar com o .env carregado (12 STRIPE_*_PRICE_ID configurados).

const PLANS: PlanType[] = ['BASICO', 'PRO', 'BUSINESS']
const INTERVALS: BillingInterval[] = ['MONTHLY', 'ANNUAL']
const CURRENCIES: Currency[] = ['BRL', 'USD']

describe('STRIPE_PRICE_IDS', () => {
  it('tem os 12 Price IDs configurados (3 planos x 2 intervalos x 2 moedas)', () => {
    for (const currency of CURRENCIES) {
      for (const plan of PLANS) {
        for (const interval of INTERVALS) {
          const priceId = STRIPE_PRICE_IDS[currency][plan][interval]
          expect(priceId, `${currency}/${plan}/${interval}`).not.toBe('')
          expect(priceId, `${currency}/${plan}/${interval}`).toMatch(/^price_/)
        }
      }
    }
  })

  it('não tem Price IDs duplicados entre planos/intervalos/moedas diferentes', () => {
    const seen = new Map<string, string>()
    for (const currency of CURRENCIES) {
      for (const plan of PLANS) {
        for (const interval of INTERVALS) {
          const priceId = STRIPE_PRICE_IDS[currency][plan][interval]
          const key = `${currency}/${plan}/${interval}`
          const existing = seen.get(priceId)
          expect(existing, `${priceId} usado em "${existing}" e "${key}"`).toBeUndefined()
          seen.set(priceId, key)
        }
      }
    }
  })
})

describe('getStripePriceId / getPlanFromPriceId', () => {
  it('é uma round-trip consistente para todo plano/intervalo/moeda', () => {
    for (const currency of CURRENCIES) {
      for (const plan of PLANS) {
        for (const interval of INTERVALS) {
          const priceId = getStripePriceId(plan, interval, currency)
          expect(priceId).not.toBeNull()

          const resolved = getPlanFromPriceId(priceId!)
          expect(resolved).toEqual({ plan, interval, currency })
        }
      }
    }
  })

  it('retorna null para um Price ID desconhecido', () => {
    expect(getPlanFromPriceId('price_inexistente')).toBeNull()
  })
})
