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

/* ------------------------------ Fases 2 a 6 ------------------------------ */

const id = z.string().min(1).max(64)
const positiveCents = z.number().int().min(1).max(100_000_000)
const text = (max: number) => z.string().trim().max(max)
const isoDate = z.coerce.date()

export const saleItemSchema = z
  .object({
    serviceId: id.nullish(),
    description: text(120).min(1, 'Descreva o item'),
    professionalId: id.nullish(),
    quantity: z.number().int().min(1).max(99),
    unitPriceCents: cents,
    discountCents: cents.optional(),
    clientPackageItemId: id.nullish()
  })
  .strict()

export const saleUpdateSchema = z
  .object({ items: z.array(saleItemSchema).min(1).max(30), discountCents: cents.optional() })
  .strict()

export const manualSaleSchema = z
  .object({
    clientId: id.nullish(),
    description: text(120).min(1, 'Descreva a venda'),
    items: z.array(saleItemSchema).min(1).max(30),
    discountCents: cents.optional()
  })
  .strict()

export const paymentPartsSchema = z
  .array(z.object({ paymentMethodId: id, amountCents: positiveCents }).strict())
  .min(1, 'Informe ao menos uma forma de pagamento')
  .max(5)

export const receiptSchema = z.object({ payments: paymentPartsSchema }).strict()

export const manualReceivableSchema = z
  .object({
    description: text(120).min(1, 'Descreva a conta'),
    categoryId: id,
    clientId: id.nullish(),
    amountCents: positiveCents,
    dueDate: isoDate
  })
  .strict()

export const reverseSchema = z.object({ reason: text(200).optional() }).strict()

export const openCashSchema = z.object({ openingCents: cents, notes: text(300).optional() }).strict()
export const cashMovementSchema = z
  .object({ kind: z.enum(['SUPPLY', 'WITHDRAWAL']), amountCents: positiveCents, description: text(120).optional() })
  .strict()
export const closeCashSchema = z.object({ countedCashCents: cents, notes: text(300).optional() }).strict()

export const payableCreateSchema = z
  .object({
    description: text(120).min(1, 'Descreva a conta'),
    categoryId: id,
    supplier: text(80).nullish(),
    notes: text(300).nullish(),
    amountCents: positiveCents,
    firstDueDate: isoDate,
    mode: z.enum(['SINGLE', 'INSTALLMENTS', 'RECURRING']).default('SINGLE'),
    count: z.number().int().min(1).max(60).default(1)
  })
  .strict()

export const payablePaymentSchema = z.object({ paymentMethodId: id, amountCents: positiveCents }).strict()
export const payableCancelSchema = z.object({ includeFollowing: z.boolean().default(false) }).strict()

export const commissionRuleSchema = z
  .discriminatedUnion('type', [
    z.object({ professionalId: id, serviceId: id.nullable(), type: z.literal('PERCENT'), valueBps: bps }).strict(),
    z.object({ professionalId: id, serviceId: id.nullable(), type: z.literal('FIXED'), valueCents: cents }).strict()
  ])

export const adjustmentCreateSchema = z
  .object({
    professionalId: id,
    kind: z.enum(['ADVANCE', 'BONUS', 'DEDUCTION']),
    amountCents: positiveCents,
    description: text(120).default(''),
    paymentMethodId: id.nullish()
  })
  .strict()
  .refine((v) => v.kind !== 'ADVANCE' || Boolean(v.paymentMethodId), 'Informe como o vale foi pago')

export const settlementCreateSchema = z
  .object({
    professionalId: id,
    paymentMethodId: id.nullish(),
    until: isoDate.nullish(),
    notes: text(300).optional()
  })
  .strict()

export const professionalCashPermissionSchema = z.object({ canOperateCash: z.boolean() }).strict()
