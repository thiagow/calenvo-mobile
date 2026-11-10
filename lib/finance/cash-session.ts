/**
 * Conferência do caixa. Pura: recebe os lançamentos da sessão e devolve o que
 * deveria estar na gaveta e os totais por forma de pagamento.
 */

export interface CashTransactionLike {
  direction: 'IN' | 'OUT'
  kind: string
  amountCents: number
  feeCents: number
  paymentMethodId: string | null
  /** Tipo da forma de pagamento; sem forma (ex.: sangria/suprimento) conta como dinheiro. */
  paymentMethodType: string | null
}

export interface MethodTotal {
  paymentMethodId: string | null
  inCents: number
  outCents: number
  feeCents: number
}

export interface CashSummary {
  openingCents: number
  cashInCents: number
  cashOutCents: number
  /** abertura + entradas em dinheiro − saídas em dinheiro */
  expectedCashCents: number
  totalInCents: number
  totalOutCents: number
  totalFeesCents: number
  byMethod: MethodTotal[]
}

export function isCashMovement(tx: Pick<CashTransactionLike, 'paymentMethodType'>): boolean {
  return tx.paymentMethodType === null || tx.paymentMethodType === 'CASH'
}

export function summarizeCashSession(openingCents: number, transactions: CashTransactionLike[]): CashSummary {
  let cashIn = 0
  let cashOut = 0
  let totalIn = 0
  let totalOut = 0
  let totalFees = 0
  const byMethod = new Map<string, MethodTotal>()

  for (const tx of transactions) {
    const key = tx.paymentMethodId ?? 'none'
    const bucket = byMethod.get(key) ?? { paymentMethodId: tx.paymentMethodId, inCents: 0, outCents: 0, feeCents: 0 }
    const signedFee = tx.direction === 'IN' ? tx.feeCents : -tx.feeCents

    if (tx.direction === 'IN') {
      totalIn += tx.amountCents
      bucket.inCents += tx.amountCents
      if (isCashMovement(tx)) cashIn += tx.amountCents
    } else {
      totalOut += tx.amountCents
      bucket.outCents += tx.amountCents
      if (isCashMovement(tx)) cashOut += tx.amountCents
    }
    // Estorno de recebimento (OUT) devolve a taxa; por isso a taxa é com sinal.
    if (tx.kind === 'RECEIPT' || tx.kind === 'REVERSAL') {
      totalFees += signedFee
      bucket.feeCents += signedFee
    }
    byMethod.set(key, bucket)
  }

  return {
    openingCents,
    cashInCents: cashIn,
    cashOutCents: cashOut,
    expectedCashCents: openingCents + cashIn - cashOut,
    totalInCents: totalIn,
    totalOutCents: totalOut,
    totalFeesCents: totalFees,
    byMethod: [...byMethod.values()]
  }
}
