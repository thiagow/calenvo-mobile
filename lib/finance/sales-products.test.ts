import { describe, expect, it, vi } from 'vitest'
import type { Tx } from './context'
import { cancelSaleRecord, createManualSale, updateSaleItems } from './sales'

/**
 * Comanda com produto, contra um `tx` em memória: prova as regras de negócio
 * (sem comissão em produto, estoque por delta, custo congelado, devolução) sem
 * banco. A lógica de Prisma em si é coberta pelo script de fluxo.
 */

interface Item {
  id: string
  saleId: string
  productId: string | null
  serviceId: string | null
  professionalId: string | null
  quantity: number
  unitPriceCents: number
  totalCents: number
  costCents: number | null
}

function memoryTx(opts: { productCost?: number; stock?: number; otherTenantProduct?: boolean } = {}) {
  const state = {
    items: [] as Item[],
    commissions: [] as { saleItemId: string; amountCents: number }[],
    movements: [] as { kind: string; quantity: number; balanceAfter: number }[],
    product: { id: 'p1', costCents: opts.productCost ?? 500, stockQty: opts.stock ?? 10, trackStock: true },
    sale: { id: 's1', userId: 't1', status: 'OPEN', description: 'Venda', appointmentId: null as string | null, origin: 'MANUAL', clientId: null, occurredAt: new Date() },
    receivable: null as null | { id: string; paidCents: number; amountCents: number; status: string },
    nextId: 1
  }
  const rules = [{ professionalId: 'pro1', serviceId: null, type: 'PERCENT', valueBps: 5000, valueCents: null }]

  const tx = {
    financeConfig: { findUnique: vi.fn(async () => null) },
    client: { count: vi.fn(async () => 1) },
    user: { count: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.length) },
    service: { count: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.length) },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        opts.otherTenantProduct ? [] : where.id.in.map((id) => ({ id, costCents: state.product.costCents }))
      ),
      findFirst: vi.fn(async () => ({ id: 'p1', trackStock: state.product.trackStock })),
      update: vi.fn(async ({ data }: { data: { stockQty: { increment: number } } }) => {
        state.product.stockQty += data.stockQty.increment
        return { stockQty: state.product.stockQty }
      })
    },
    stockMovement: {
      create: vi.fn(async ({ data }: { data: { kind: string; quantity: number; balanceAfter: number } }) => {
        state.movements.push({ kind: data.kind, quantity: data.quantity, balanceAfter: data.balanceAfter })
        return data
      })
    },
    commissionRule: { findMany: vi.fn(async () => rules) },
    commission: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: { saleItemId: string; amountCents: number } }) => {
        state.commissions.push({ saleItemId: data.saleItemId, amountCents: data.amountCents })
        return data
      }),
      findMany: vi.fn(async () => [])
    },
    saleItem: {
      findMany: vi.fn(async ({ where }: { where: { saleId: string; productId?: unknown } }) =>
        state.items.filter((i) => i.saleId === where.saleId && (where.productId === undefined || i.productId !== null))
      ),
      deleteMany: vi.fn(async () => {
        state.items = []
      }),
      create: vi.fn(async ({ data }: { data: Omit<Item, 'id'> }) => {
        const item = { ...data, id: 'i' + state.nextId++ } as Item
        state.items.push(item)
        return item
      })
    },
    financeCategory: { findUnique: vi.fn(async () => ({ id: 'cat1' })) },
    receivable: {
      findUnique: vi.fn(async () => state.receivable),
      create: vi.fn(async ({ data }: { data: { amountCents: number } }) => {
        state.receivable = { id: 'r1', paidCents: 0, amountCents: data.amountCents, status: 'OPEN' }
        return state.receivable
      }),
      update: vi.fn(async ({ data }: { data: { amountCents?: number; status?: string } }) => {
        state.receivable = { ...state.receivable!, ...data } as typeof state.receivable
        return state.receivable
      }),
      delete: vi.fn(async () => {
        state.receivable = null
      })
    },
    sale: {
      create: vi.fn(async () => state.sale),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.sale, data)
        return state.sale
      }),
      findUniqueOrThrow: vi.fn(async () => state.sale),
      findFirst: vi.fn(async () => ({ ...state.sale, receivable: state.receivable })),
      findUnique: vi.fn(async () => null)
    },
    $queryRawUnsafe: vi.fn(async () => [{ id: 's1' }])
  }
  return { tx: tx as unknown as Tx, state }
}

const productItem = (quantity: number, extra: Record<string, unknown> = {}) => ({
  productId: 'p1',
  description: 'Pomada',
  quantity,
  unitPriceCents: 4_000,
  ...extra
})
const serviceItem = { serviceId: 'sv1', description: 'Corte', professionalId: 'pro1', quantity: 1, unitPriceCents: 10_000 }
const base = { tenantId: 't1', actorId: 'u1', clientId: null, description: 'Venda' }

describe('comanda com produto', () => {
  it('produto não gera comissão mesmo com profissional informado; o serviço gera', async () => {
    const { tx, state } = memoryTx()
    await createManualSale(tx, { ...base, items: [serviceItem, productItem(1, { professionalId: 'pro1' })] })

    expect(state.items.find((i) => i.productId)?.professionalId).toBeNull()
    expect(state.commissions).toHaveLength(1)
    const serviceLine = state.items.find((i) => i.serviceId)!
    expect(state.commissions[0]).toEqual({ saleItemId: serviceLine.id, amountCents: 5_000 })
  })

  it('vender baixa o estoque e registra o movimento', async () => {
    const { tx, state } = memoryTx({ stock: 10 })
    await createManualSale(tx, { ...base, items: [productItem(3)] })
    expect(state.product.stockQty).toBe(7)
    expect(state.movements).toEqual([{ kind: 'SALE', quantity: -3, balanceAfter: 7 }])
  })

  it('guarda o custo do produto no momento da venda', async () => {
    const { tx, state } = memoryTx({ productCost: 500 })
    await createManualSale(tx, { ...base, items: [productItem(1)] })
    expect(state.items[0].costCents).toBe(500)
  })

  it('editar a quantidade baixa só a diferença', async () => {
    const { tx, state } = memoryTx({ stock: 10 })
    await createManualSale(tx, { ...base, items: [productItem(3)] })
    await updateSaleItems(tx, { tenantId: 't1', saleId: 's1', actorId: 'u1', items: [productItem(5)] })
    expect(state.product.stockQty).toBe(5)
    expect(state.movements.at(-1)).toEqual({ kind: 'SALE', quantity: -2, balanceAfter: 5 })
  })

  it('salvar a comanda de novo sem mudar nada não mexe no estoque', async () => {
    const { tx, state } = memoryTx({ stock: 10 })
    await createManualSale(tx, { ...base, items: [productItem(3)] })
    const before = state.movements.length
    await updateSaleItems(tx, { tenantId: 't1', saleId: 's1', actorId: 'u1', items: [productItem(3)] })
    expect(state.movements).toHaveLength(before)
    expect(state.product.stockQty).toBe(7)
  })

  it('o custo congelado não muda se o custo do produto mudar depois', async () => {
    const { tx, state } = memoryTx({ productCost: 500 })
    await createManualSale(tx, { ...base, items: [productItem(1)] })
    state.product.costCents = 900
    await updateSaleItems(tx, { tenantId: 't1', saleId: 's1', actorId: 'u1', items: [productItem(2)] })
    expect(state.items[0].costCents).toBe(500)
  })

  it('remover o produto da comanda devolve o estoque', async () => {
    const { tx, state } = memoryTx({ stock: 10 })
    await createManualSale(tx, { ...base, items: [productItem(3), serviceItem] })
    await updateSaleItems(tx, { tenantId: 't1', saleId: 's1', actorId: 'u1', items: [serviceItem] })
    expect(state.product.stockQty).toBe(10)
    expect(state.movements.at(-1)).toMatchObject({ kind: 'SALE_REVERSAL', quantity: 3 })
  })

  it('cancelar a comanda devolve o estoque', async () => {
    const { tx, state } = memoryTx({ stock: 10 })
    await createManualSale(tx, { ...base, items: [productItem(4)] })
    expect(state.product.stockQty).toBe(6)
    await cancelSaleRecord(tx, { tenantId: 't1', saleId: 's1', actorId: 'u1', reason: 'erro' })
    expect(state.product.stockQty).toBe(10)
  })

  it('vender mais do que há em estoque não bloqueia (saldo fica negativo)', async () => {
    const { tx, state } = memoryTx({ stock: 1 })
    await createManualSale(tx, { ...base, items: [productItem(3)] })
    expect(state.product.stockQty).toBe(-2)
  })

  it('recusa produto misturado com serviço no mesmo item', async () => {
    const { tx } = memoryTx()
    await expect(createManualSale(tx, { ...base, items: [productItem(1, { serviceId: 'sv1' })] })).rejects.toThrow(/misturado/)
  })

  it('produto de outro tenant é tratado como inexistente', async () => {
    const { tx } = memoryTx({ otherTenantProduct: true })
    await expect(createManualSale(tx, { ...base, items: [productItem(1)] })).rejects.toThrow(/Produto inválido/)
  })
})
