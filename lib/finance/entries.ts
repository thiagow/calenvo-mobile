import { applyBps } from './money'

/** Regras puras de contas a receber/pagar e de taxas de pagamento. */

export type EntryStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED'

export function deriveEntryStatus(amountCents: number, paidCents: number): Exclude<EntryStatus, 'CANCELLED'> {
  if (paidCents <= 0) return amountCents === 0 ? 'PAID' : 'OPEN'
  return paidCents >= amountCents ? 'PAID' : 'PARTIAL'
}

/** Taxa cobrada pela operadora numa transação, nunca maior que o valor. */
export function computeFee(amountCents: number, method: { feeBps: number; feeFixedCents: number }): number {
  if (amountCents <= 0) return 0
  return Math.min(amountCents, applyBps(amountCents, method.feeBps) + method.feeFixedCents)
}

/** Soma o mês preservando o fim do mês (31/01 + 1 mês = 28 ou 29/02). Datas em UTC. */
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

export interface ScheduledEntry {
  amountCents: number
  dueDate: Date
  installment: number
  ofInstallments: number
}

/**
 * Parcelamento: divide o total em N parcelas mensais (centavos que sobram vão
 * para as primeiras). Recorrência: repete o mesmo valor N meses.
 */
export function buildPaymentSchedule(
  mode: 'SINGLE' | 'INSTALLMENTS' | 'RECURRING',
  amountCents: number,
  firstDueDate: Date,
  count: number
): ScheduledEntry[] {
  const n = mode === 'SINGLE' ? 1 : Math.max(1, Math.min(60, Math.floor(count)))
  if (mode === 'INSTALLMENTS') {
    const base = Math.floor(amountCents / n)
    const remainder = amountCents - base * n
    return Array.from({ length: n }, (_, i) => ({
      amountCents: base + (i < remainder ? 1 : 0),
      dueDate: addMonthsClamped(firstDueDate, i),
      installment: i + 1,
      ofInstallments: n
    }))
  }
  return Array.from({ length: n }, (_, i) => ({
    amountCents,
    dueDate: addMonthsClamped(firstDueDate, i),
    installment: i + 1,
    ofInstallments: n
  }))
}
