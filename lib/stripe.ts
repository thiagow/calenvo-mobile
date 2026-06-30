import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY não está definida nas variáveis de ambiente')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

export const STRIPE_STANDARD_PRICE_ID = process.env.STRIPE_STANDARD_PRICE_ID || ''

if (!STRIPE_STANDARD_PRICE_ID) {
  console.warn('⚠️ STRIPE_STANDARD_PRICE_ID não está definida')
}
