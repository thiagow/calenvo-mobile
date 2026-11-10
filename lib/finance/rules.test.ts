import { describe, it, expect } from 'vitest'
import { commissionBaseFor, computeCommission, recomputeFromSnapshot, resolveCommissionRule, type CommissionRuleLike } from './commission'
import { computeSessionValues } from './package-session-value'
import { summarizeCashSession, type CashTransactionLike } from './cash-session'
import { computeSettlementTotals, isCommissionEligible } from './settlement'
import { addMonthsClamped, buildPaymentSchedule, computeFee, deriveEntryStatus } from './entries'

const rule = (r: Partial<CommissionRuleLike>): CommissionRuleLike => ({
  professionalId: 'marina',
  serviceId: null,
  type: 'PERCENT',
  valueBps: null,
  valueCents: null,
  ...r
})

describe('comissão — hierarquia', () => {
  const rules = [
    rule({ valueBps: 4000 }), // Marina: 40% padrão
    rule({ serviceId: 'hidratacao', type: 'FIXED', valueCents: 3000 }), // R$ 30 na hidratação
    rule({ professionalId: 'joao', valueBps: 3000 })
  ]

  it('profissional × serviço vence o padrão', () => {
    expect(resolveCommissionRule(rules, 'marina', 'hidratacao')?.type).toBe('FIXED')
  })

  it('sem regra do serviço, usa o padrão do profissional', () => {
    expect(resolveCommissionRule(rules, 'marina', 'mechas')?.valueBps).toBe(4000)
    expect(resolveCommissionRule(rules, 'marina', null)?.valueBps).toBe(4000)
  })

  it('profissional sem regra não tem comissão', () => {
    expect(resolveCommissionRule(rules, 'john', 'mechas')).toBeNull()
  })

  it('não mistura regras de outro profissional', () => {
    expect(resolveCommissionRule(rules, 'joao', 'hidratacao')?.valueBps).toBe(3000)
  })
})

describe('comissão — cálculo', () => {
  it('percentual sobre a base', () => {
    expect(computeCommission(rule({ valueBps: 4000 }), 28000)).toEqual({ ruleType: 'PERCENT', ruleValue: 4000, amountCents: 11200 })
  })

  it('fixa por unidade, limitada à base', () => {
    const fixed = rule({ type: 'FIXED', valueCents: 3000 })
    expect(computeCommission(fixed, 15000).amountCents).toBe(3000)
    expect(computeCommission(fixed, 15000, 2).amountCents).toBe(6000)
    expect(computeCommission(fixed, 2000).amountCents).toBe(2000)
    expect(computeCommission(fixed, 0).amountCents).toBe(0) // cortesia
  })

  it('base: depois do desconto, ou também depois da taxa', () => {
    const item = { totalCents: 15000, feeCents: 524 }
    expect(commissionBaseFor(item, 'AFTER_DISCOUNT')).toBe(15000)
    expect(commissionBaseFor(item, 'AFTER_FEES')).toBe(14476)
  })

  it('base de sessão de pacote é o valor da sessão', () => {
    expect(commissionBaseFor({ totalCents: 0, feeCents: 0, sessionValueCents: 6000 }, 'AFTER_FEES')).toBe(6000)
  })

  it('recalcula pelo snapshot (regra mudou depois não importa)', () => {
    expect(recomputeFromSnapshot({ ruleType: 'PERCENT', ruleValue: 4000 }, 14476)).toBe(5790)
    expect(recomputeFromSnapshot({ ruleType: 'FIXED', ruleValue: 3000 }, 14476)).toBe(3000)
  })
})

describe('valor da sessão de pacote', () => {
  it('rateia pelo preço de tabela', () => {
    // R$ 300 = 4 cortes (R$ 50) + 2 barbas (R$ 25)
    expect(
      computeSessionValues(30000, [
        { servicePriceCents: 5000, totalSessions: 4 },
        { servicePriceCents: 2500, totalSessions: 2 }
      ])
    ).toEqual([6000, 3000])
  })

  it('sem preço de tabela, divide igual por sessão', () => {
    expect(
      computeSessionValues(30000, [
        { servicePriceCents: null, totalSessions: 4 },
        { servicePriceCents: null, totalSessions: 2 }
      ])
    ).toEqual([5000, 5000])
  })

  it('pacote grátis gera sessão de valor zero', () => {
    expect(computeSessionValues(0, [{ servicePriceCents: 5000, totalSessions: 3 }])).toEqual([0])
  })

  it('rejeita sessões inválidas', () => {
    expect(() => computeSessionValues(100, [{ servicePriceCents: 1, totalSessions: 0 }])).toThrow()
  })
})

describe('conferência do caixa', () => {
  const tx = (t: Partial<CashTransactionLike>): CashTransactionLike => ({
    direction: 'IN',
    kind: 'RECEIPT',
    amountCents: 0,
    feeCents: 0,
    paymentMethodId: 'cash',
    paymentMethodType: 'CASH',
    ...t
  })

  it('esperado em dinheiro = abertura + entradas − saídas, só em dinheiro', () => {
    const summary = summarizeCashSession(20000, [
      tx({ amountCents: 15000 }), // dinheiro
      tx({ amountCents: 28000, paymentMethodId: 'pix', paymentMethodType: 'PIX' }),
      tx({ amountCents: 18000, feeCents: 628, paymentMethodId: 'credit', paymentMethodType: 'CREDIT' }),
      tx({ direction: 'OUT', kind: 'WITHDRAWAL', amountCents: 10000, paymentMethodId: null, paymentMethodType: null }),
      tx({ direction: 'IN', kind: 'SUPPLY', amountCents: 5000, paymentMethodId: null, paymentMethodType: null }),
      tx({ direction: 'OUT', kind: 'COMMISSION_PAYOUT', amountCents: 6000 })
    ])
    expect(summary.expectedCashCents).toBe(20000 + 15000 + 5000 - 10000 - 6000)
    expect(summary.totalInCents).toBe(15000 + 28000 + 18000 + 5000)
    expect(summary.totalFeesCents).toBe(628)
    expect(summary.byMethod.find((m) => m.paymentMethodId === 'pix')?.inCents).toBe(28000)
  })

  it('estorno de recebimento devolve a taxa', () => {
    const summary = summarizeCashSession(0, [
      tx({ amountCents: 18000, feeCents: 628, paymentMethodType: 'CREDIT' }),
      tx({ direction: 'OUT', kind: 'REVERSAL', amountCents: 18000, feeCents: 628, paymentMethodType: 'CREDIT' })
    ])
    expect(summary.totalFeesCents).toBe(0)
    expect(summary.expectedCashCents).toBe(0)
  })
})

describe('acerto', () => {
  it('líquido = comissões + bônus − vales − descontos', () => {
    expect(
      computeSettlementTotals([{ amountCents: 11200 }, { amountCents: 3000 }], [
        { kind: 'ADVANCE', amountCents: 5000 },
        { kind: 'BONUS', amountCents: 2000 },
        { kind: 'DEDUCTION', amountCents: 1000 }
      ])
    ).toEqual({ commissionsCents: 14200, bonusesCents: 2000, deductionsCents: 6000, netCents: 10200 })
  })

  it('"só o que já foi pago" segura comissão de fiado', () => {
    expect(isCommissionEligible({ amountCents: 100, salePaid: false }, true)).toBe(false)
    expect(isCommissionEligible({ amountCents: 100, salePaid: false }, false)).toBe(true)
    expect(isCommissionEligible({ amountCents: 100, salePaid: true }, true)).toBe(true)
  })
})

describe('contas e taxas', () => {
  it('status derivado do pago', () => {
    expect(deriveEntryStatus(1000, 0)).toBe('OPEN')
    expect(deriveEntryStatus(1000, 400)).toBe('PARTIAL')
    expect(deriveEntryStatus(1000, 1000)).toBe('PAID')
    expect(deriveEntryStatus(0, 0)).toBe('PAID')
  })

  it('taxa percentual + fixa, nunca maior que o valor', () => {
    expect(computeFee(18000, { feeBps: 349, feeFixedCents: 0 })).toBe(628)
    expect(computeFee(10000, { feeBps: 199, feeFixedCents: 50 })).toBe(249)
    expect(computeFee(30, { feeBps: 0, feeFixedCents: 50 })).toBe(30)
    expect(computeFee(0, { feeBps: 500, feeFixedCents: 50 })).toBe(0)
  })

  it('mês seguinte preserva o fim do mês', () => {
    expect(addMonthsClamped(new Date('2026-01-31T12:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28')
    expect(addMonthsClamped(new Date('2026-11-30T12:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2027-02-28')
  })

  it('parcelamento distribui os centavos e soma exato', () => {
    const parts = buildPaymentSchedule('INSTALLMENTS', 10000, new Date('2026-11-10T12:00:00Z'), 3)
    expect(parts.map((p) => p.amountCents)).toEqual([3334, 3333, 3333])
    expect(parts.map((p) => p.dueDate.toISOString().slice(0, 10))).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(parts[2]).toMatchObject({ installment: 3, ofInstallments: 3 })
  })

  it('recorrência repete o valor; avulsa é uma só', () => {
    expect(buildPaymentSchedule('RECURRING', 250000, new Date('2026-11-05T12:00:00Z'), 12).every((p) => p.amountCents === 250000)).toBe(true)
    expect(buildPaymentSchedule('SINGLE', 500, new Date(), 12)).toHaveLength(1)
  })
})
