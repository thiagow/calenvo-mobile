import { describe, it, expect, vi } from 'vitest'
import { computeSaleLines } from './sales'
import { createSettlement } from './commissions'
import { registerReceipt } from './receipts'
import { findAddonItem, pickPlanPriceId, syncFinanceAddon } from './addon'
import type { Tx } from './context'

/**
 * Invariantes da camada transacional que não dependem de banco real:
 * rateio de desconto, contra pagamento em dobro, saldo e caixa exigido,
 * e a sincronização do add-on (que nunca derruba uma liberação do admin).
 */

describe('comanda — totais', () => {
  it('desconto da comanda é rateado pelos itens e a soma bate', () => {
    const { lines, totals } = computeSaleLines(
      [
        { quantity: 1, unitPriceCents: 28000 },
        { quantity: 1, unitPriceCents: 15000 }
      ],
      4300
    )
    expect(totals).toEqual({ subtotalCents: 43000, discountCents: 4300, totalCents: 38700 })
    expect(lines.map((l) => l.totalCents)).toEqual([25200, 13500])
    expect(lines.reduce((a, l) => a + l.totalCents, 0)).toBe(totals.totalCents)
  })

  it('desconto do item + desconto da comanda', () => {
    const { lines, totals } = computeSaleLines([{ quantity: 2, unitPriceCents: 5000, discountCents: 1000 }], 900)
    expect(totals.totalCents).toBe(8100)
    expect(lines[0].discountCents).toBe(1900)
  })

  it('desconto maior que o valor é recusado', () => {
    expect(() => computeSaleLines([{ quantity: 1, unitPriceCents: 1000 }], 1001)).toThrow(/Desconto/)
    expect(() => computeSaleLines([{ quantity: 1, unitPriceCents: 1000, discountCents: 2000 }])).toThrow(/Desconto/)
  })
})

function settlementTx(claimed: { commissions: number; adjustments: number }) {
  const created: unknown[] = []
  const tx = {
    user: {
      count: vi.fn(async () => 1),
      findUnique: vi.fn(async () => ({ name: 'Marina' }))
    },
    financeConfig: { findUnique: vi.fn(async () => ({ settleOnlyPaidCommissions: true, commissionBase: 'AFTER_DISCOUNT', requireOpenCashSession: true })) },
    commission: {
      findMany: vi.fn(async () => [
        {
          id: 'c1',
          amountCents: 11200,
          baseCents: 28000,
          ruleType: 'PERCENT',
          ruleValue: 4000,
          saleItem: {
            description: 'Mechas',
            totalCents: 28000,
            clientPackageItemId: null,
            sale: { id: 's1', status: 'CLOSED', occurredAt: new Date('2026-11-10T13:00:00Z'), totalCents: 28000, client: { name: 'Ana' }, receivable: { status: 'PAID' } }
          }
        }
      ]),
      updateMany: vi.fn(async () => ({ count: claimed.commissions }))
    },
    professionalAdjustment: {
      findMany: vi.fn(async () => [{ id: 'a1', kind: 'ADVANCE', amountCents: 5000, description: 'Vale', createdAt: new Date() }]),
      updateMany: vi.fn(async () => ({ count: claimed.adjustments }))
    },
    paymentMethod: { findFirst: vi.fn(async () => ({ id: 'pix', name: 'Pix', type: 'PIX', isActive: true, feeBps: 0, feeFixedCents: 0 })) },
    cashSession: { findFirst: vi.fn(async () => ({ id: 'cash-1' })) },
    commissionSettlement: { create: vi.fn(async (args: { data: unknown }) => (created.push(args.data), { id: 'set-1', ...(args.data as object) })) },
    financialTransaction: { create: vi.fn(async (args: { data: unknown }) => (created.push(args.data), { id: 'tx-1' })) }
  }
  return { tx: tx as unknown as Tx, raw: tx, created }
}

describe('acerto', () => {
  it('paga o líquido (comissões − vale) e reserva comissões e vales', async () => {
    const { tx, raw } = settlementTx({ commissions: 1, adjustments: 1 })
    await createSettlement(tx, { tenantId: 't', actorId: 'owner', professionalId: 'marina', paymentMethodId: 'pix' })
    expect(raw.commissionSettlement.create.mock.calls[0][0].data).toMatchObject({ commissionsCents: 11200, deductionsCents: 5000, netCents: 6200 })
    expect(raw.financialTransaction.create.mock.calls[0][0].data).toMatchObject({ kind: 'COMMISSION_PAYOUT', direction: 'OUT', amountCents: 6200, cashSessionId: 'cash-1' })
  })

  it('acerto concorrente (comissão já reservada por outro) falha e desfaz', async () => {
    const { tx, raw } = settlementTx({ commissions: 0, adjustments: 1 })
    await expect(createSettlement(tx, { tenantId: 't', actorId: 'owner', professionalId: 'marina', paymentMethodId: 'pix' })).rejects.toThrow(/alterado por outra pessoa/)
    expect(raw.financialTransaction.create).not.toHaveBeenCalled()
  })

  it('exige forma de pagamento quando há valor a pagar', async () => {
    const { tx } = settlementTx({ commissions: 1, adjustments: 1 })
    await expect(createSettlement(tx, { tenantId: 't', actorId: 'owner', professionalId: 'marina' })).rejects.toThrow(/Informe como/)
  })
})

function receiptTx({ openSession, method }: { openSession: boolean; method: 'CASH' | 'PIX' }) {
  const receivable = { id: 'r1', userId: 't', amountCents: 15000, paidCents: 5000, status: 'PARTIAL', saleId: null, description: 'Hidratação' }
  const tx = {
    receivable: {
      findFirst: vi.fn(async () => receivable),
      findUniqueOrThrow: vi.fn(async () => receivable),
      update: vi.fn(async (args: { data: object }) => ({ ...receivable, ...args.data }))
    },
    $queryRawUnsafe: vi.fn(async () => [{ id: 'r1' }]),
    financeConfig: { findUnique: vi.fn(async () => ({ requireOpenCashSession: true, commissionBase: 'AFTER_DISCOUNT', settleOnlyPaidCommissions: true })) },
    paymentMethod: { findFirst: vi.fn(async () => ({ id: 'm', name: method, type: method, isActive: true, feeBps: 349, feeFixedCents: 0 })) },
    cashSession: { findFirst: vi.fn(async () => (openSession ? { id: 'cash-1' } : null)) },
    financialTransaction: { create: vi.fn(async (args: { data: object }) => ({ id: 'tx', ...args.data })) }
  }
  return { tx: tx as unknown as Tx, raw: tx }
}

describe('recebimento', () => {
  it('não recebe mais que o saldo em aberto', async () => {
    const { tx } = receiptTx({ openSession: true, method: 'PIX' })
    await expect(
      registerReceipt(tx, { tenantId: 't', receivableId: 'r1', actorId: 'u', payments: [{ paymentMethodId: 'm', amountCents: 10001 }] })
    ).rejects.toThrow(/maior que o saldo/)
  })

  it('exige caixa aberto para receber', async () => {
    const { tx, raw } = receiptTx({ openSession: false, method: 'PIX' })
    await expect(
      registerReceipt(tx, { tenantId: 't', receivableId: 'r1', actorId: 'u', payments: [{ paymentMethodId: 'm', amountCents: 10000 }] })
    ).rejects.toThrow(/Abra o caixa/)
    expect(raw.financialTransaction.create).not.toHaveBeenCalled()
  })

  it('quita, grava a taxa da operadora e liga ao caixa aberto', async () => {
    const { tx, raw } = receiptTx({ openSession: true, method: 'PIX' })
    const { receivable } = await registerReceipt(tx, { tenantId: 't', receivableId: 'r1', actorId: 'u', payments: [{ paymentMethodId: 'm', amountCents: 10000 }] })
    expect(raw.financialTransaction.create.mock.calls[0][0].data).toMatchObject({ direction: 'IN', kind: 'RECEIPT', amountCents: 10000, feeCents: 349, cashSessionId: 'cash-1' })
    expect(receivable).toMatchObject({ paidCents: 15000, status: 'PAID' })
  })
})

describe('add-on no Stripe', () => {
  const items = [
    { id: 'si_addon', price: { id: 'price_fin' } },
    { id: 'si_plan', price: { id: 'price_pro' } }
  ]

  it('acha o plano mesmo com o add-on como primeiro item', () => {
    expect(pickPlanPriceId(items, (id) => id === 'price_pro')).toBe('price_pro')
    expect(findAddonItem(items, ['price_fin'])?.id).toBe('si_addon')
  })

  function addonDb(current: null | { id: string; source: string; status: string }) {
    return {
      tenantFeature: {
        findUnique: vi.fn(async () => current),
        upsert: vi.fn(async (_args: unknown) => ({})),
        update: vi.fn(async (_args: unknown) => ({}))
      }
    }
  }

  it('assinatura com add-on ativa o direito de uso como ADDON', async () => {
    const db = addonDb(null)
    const outcome = await syncFinanceAddon(db as never, { tenantId: 't', subscriptionStatus: 'active', items, addonPriceIds: ['price_fin'] })
    expect(outcome).toBe('activated')
    expect(db.tenantFeature.upsert.mock.calls[0][0] as object).toMatchObject({ create: { source: 'ADDON', stripeSubscriptionItemId: 'si_addon' } })
  })

  it('remover o add-on cancela só o direito de origem ADDON', async () => {
    const db = addonDb({ id: 'tf', source: 'ADDON', status: 'ACTIVE' })
    expect(await syncFinanceAddon(db as never, { tenantId: 't', subscriptionStatus: 'active', items: [items[1]], addonPriceIds: ['price_fin'] })).toBe('canceled')
  })

  it('liberação do admin (GRANT) nunca é derrubada pelo Stripe', async () => {
    const db = addonDb({ id: 'tf', source: 'GRANT', status: 'ACTIVE' })
    expect(await syncFinanceAddon(db as never, { tenantId: 't', subscriptionStatus: 'canceled', items: [], addonPriceIds: ['price_fin'] })).toBe('unchanged')
    expect(db.tenantFeature.update).not.toHaveBeenCalled()
  })

  it('sem price configurado não faz nada', async () => {
    const db = addonDb(null)
    expect(await syncFinanceAddon(db as never, { tenantId: 't', subscriptionStatus: 'active', items, addonPriceIds: [] })).toBe('not_configured')
  })
})
