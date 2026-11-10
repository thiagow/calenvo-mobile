/**
 * Acerto com o profissional: comissões + bônus − (vales + descontos) = líquido.
 */

export interface SettlementCommissionLike {
  amountCents: number
  /** Comanda quitada (ou sessão de pacote, que não cobra o cliente). */
  salePaid: boolean
}

export interface SettlementAdjustmentLike {
  kind: 'ADVANCE' | 'BONUS' | 'DEDUCTION'
  amountCents: number
}

export interface SettlementTotals {
  commissionsCents: number
  bonusesCents: number
  deductionsCents: number
  netCents: number
}

/** Comissão entra no acerto se a comanda foi paga ou se a regra permitir acertar o que está em aberto. */
export function isCommissionEligible(c: SettlementCommissionLike, settleOnlyPaid: boolean): boolean {
  return !settleOnlyPaid || c.salePaid
}

export function computeSettlementTotals(
  commissions: Pick<SettlementCommissionLike, 'amountCents'>[],
  adjustments: SettlementAdjustmentLike[]
): SettlementTotals {
  const commissionsCents = commissions.reduce((acc, c) => acc + c.amountCents, 0)
  const bonusesCents = adjustments.filter((a) => a.kind === 'BONUS').reduce((acc, a) => acc + a.amountCents, 0)
  const deductionsCents = adjustments.filter((a) => a.kind !== 'BONUS').reduce((acc, a) => acc + a.amountCents, 0)
  return {
    commissionsCents,
    bonusesCents,
    deductionsCents,
    netCents: commissionsCents + bonusesCents - deductionsCents
  }
}
