import { applyBps } from './money'

/**
 * Comissão: regra mais específica vence (profissional × serviço > padrão do
 * profissional > sem comissão). Funções puras — o banco só guarda o snapshot.
 */

export type CommissionRuleType = 'PERCENT' | 'FIXED'

export interface CommissionRuleLike {
  professionalId: string
  serviceId: string | null
  type: CommissionRuleType
  valueBps: number | null
  valueCents: number | null
}

export interface CommissionResult {
  ruleType: CommissionRuleType
  /** bps (PERCENT) ou centavos por unidade (FIXED) — o snapshot da regra. */
  ruleValue: number
  amountCents: number
}

export function resolveCommissionRule<T extends CommissionRuleLike>(
  rules: T[],
  professionalId: string,
  serviceId: string | null
): T | null {
  const own = rules.filter((r) => r.professionalId === professionalId)
  return (serviceId ? own.find((r) => r.serviceId === serviceId) : undefined) ?? own.find((r) => r.serviceId === null) ?? null
}

/**
 * Base da comissão de um item.
 * - AFTER_DISCOUNT: o que foi cobrado do item (já com desconto).
 * - AFTER_FEES: também desconta a parte das taxas de pagamento rateada no item.
 * Item de pacote cobra 0 do cliente; a base é o valor proporcional da sessão.
 */
export function commissionBaseFor(
  item: { totalCents: number; feeCents: number; sessionValueCents?: number | null },
  mode: 'AFTER_DISCOUNT' | 'AFTER_FEES'
): number {
  if (item.sessionValueCents != null) return Math.max(0, item.sessionValueCents)
  const base = mode === 'AFTER_FEES' ? item.totalCents - item.feeCents : item.totalCents
  return Math.max(0, base)
}

/**
 * Valor da comissão. Fixa = valor por unidade × quantidade, limitada à base:
 * cortesia (base 0) não gera comissão e a comissão nunca passa do que entrou.
 */
export function computeCommission(rule: CommissionRuleLike, baseCents: number, quantity = 1): CommissionResult {
  if (rule.type === 'PERCENT') {
    const bps = rule.valueBps ?? 0
    return { ruleType: 'PERCENT', ruleValue: bps, amountCents: applyBps(Math.max(0, baseCents), bps) }
  }
  const perUnit = rule.valueCents ?? 0
  return {
    ruleType: 'FIXED',
    ruleValue: perUnit,
    amountCents: Math.min(perUnit * Math.max(1, quantity), Math.max(0, baseCents))
  }
}

/** Recalcula a partir do snapshot (usado quando a base muda, ex.: taxa rateada). */
export function recomputeFromSnapshot(
  snapshot: { ruleType: CommissionRuleType; ruleValue: number },
  baseCents: number,
  quantity = 1
): number {
  return computeCommission(
    {
      professionalId: '',
      serviceId: null,
      type: snapshot.ruleType,
      valueBps: snapshot.ruleType === 'PERCENT' ? snapshot.ruleValue : null,
      valueCents: snapshot.ruleType === 'FIXED' ? snapshot.ruleValue : null
    },
    baseCents,
    quantity
  ).amountCents
}
