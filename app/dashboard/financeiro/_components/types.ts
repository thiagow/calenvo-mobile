import type { CurrencyCode } from '@/lib/finance/money'

export type CommissionBase = 'AFTER_DISCOUNT' | 'AFTER_FEES'
export type PaymentMethodType = 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'OTHER'
export type CategoryKind = 'INCOME' | 'EXPENSE'

export interface FinanceConfigDto {
  isActive: boolean
  activatedAt: string | null
  commissionBase: CommissionBase
  requireOpenCashSession: boolean
  settleOnlyPaidCommissions: boolean
}

export interface PaymentMethodDto {
  id: string
  name: string
  type: PaymentMethodType
  feeBps: number
  feeFixedCents: number
  isActive: boolean
  sortOrder: number
}

export interface FinanceCategoryDto {
  id: string
  kind: CategoryKind
  name: string
  systemKey: string | null
  isSystem: boolean
  isActive: boolean
}

export type { CurrencyCode }

/** fetch JSON com erro legível vindo da API (`{ error }`). */
export async function financeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? 'Não foi possível concluir a operação')
  return body as T
}
