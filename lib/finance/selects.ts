/** Campos expostos ao cliente pelas rotas do financeiro (nunca o registro inteiro). */

export const PAYMENT_METHOD_SELECT = {
  id: true,
  name: true,
  type: true,
  feeBps: true,
  feeFixedCents: true,
  isActive: true,
  sortOrder: true
} as const

export const FINANCE_CATEGORY_SELECT = {
  id: true,
  kind: true,
  name: true,
  systemKey: true,
  isSystem: true,
  isActive: true
} as const
