import { z } from 'zod'

/** Validação de entrada das rotas /api/finance/*. Valores sempre em centavos/bps inteiros. */

const cents = z.number().int().min(0).max(100_000_000) // até 1 milhão por lançamento
const bps = z.number().int().min(0).max(10_000)
const name = z.string().trim().min(1, 'Informe um nome').max(60)

export const financeConfigUpdateSchema = z
  .object({
    isActive: z.boolean(),
    commissionBase: z.enum(['AFTER_DISCOUNT', 'AFTER_FEES']),
    requireOpenCashSession: z.boolean(),
    settleOnlyPaidCommissions: z.boolean()
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nenhuma alteração enviada')

export const paymentMethodTypeSchema = z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT', 'TRANSFER', 'OTHER'])

export const paymentMethodCreateSchema = z
  .object({
    name,
    type: paymentMethodTypeSchema,
    feeBps: bps.default(0),
    feeFixedCents: cents.default(0)
  })
  .strict()

export const paymentMethodUpdateSchema = z
  .object({
    name,
    type: paymentMethodTypeSchema,
    feeBps: bps,
    feeFixedCents: cents,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000)
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nenhuma alteração enviada')

export const financeCategoryCreateSchema = z
  .object({
    name,
    kind: z.enum(['INCOME', 'EXPENSE'])
  })
  .strict()

export const financeCategoryUpdateSchema = z
  .object({ name, isActive: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nenhuma alteração enviada')

export const tenantFeatureUpdateSchema = z
  .object({
    feature: z.enum(['FINANCE']),
    enabled: z.boolean(),
    reason: z.string().trim().max(500).optional()
  })
  .strict()

/** Primeira mensagem de erro legível do Zod, para resposta 400. */
export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos'
}
