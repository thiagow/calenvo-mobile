import Stripe from 'stripe'
import { PlanType } from '@prisma/client'
import type { Currency } from '@/lib/types'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY não está definida nas variáveis de ambiente')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

export type BillingInterval = 'MONTHLY' | 'ANNUAL'

// Mapa de Price IDs do Stripe por moeda, plano e intervalo de cobrança.
// Server-only: nunca importar este módulo em componentes de cliente.
export const STRIPE_PRICE_IDS: Record<Currency, Record<PlanType, Record<BillingInterval, string>>> = {
  BRL: {
    BASICO: {
      MONTHLY: process.env.STRIPE_BASICO_MONTHLY_PRICE_ID || '',
      ANNUAL: process.env.STRIPE_BASICO_ANNUAL_PRICE_ID || '',
    },
    PRO: {
      MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
      ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
    },
    BUSINESS: {
      MONTHLY: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
      ANNUAL: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || '',
    },
  },
  USD: {
    BASICO: {
      MONTHLY: process.env.STRIPE_BASICO_MONTHLY_PRICE_ID_USD || '',
      ANNUAL: process.env.STRIPE_BASICO_ANNUAL_PRICE_ID_USD || '',
    },
    PRO: {
      MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID_USD || '',
      ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID_USD || '',
    },
    BUSINESS: {
      MONTHLY: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID_USD || '',
      ANNUAL: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID_USD || '',
    },
  },
}

export function getStripePriceId(plan: PlanType, interval: BillingInterval, currency: Currency = 'BRL'): string | null {
  const priceId = STRIPE_PRICE_IDS[currency]?.[plan]?.[interval]
  return priceId || null
}
