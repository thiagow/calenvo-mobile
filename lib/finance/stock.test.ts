import { describe, expect, it, vi } from 'vitest'
import type { Tx } from './context'
import { applySaleStockDeltas, computeStockDeltas, registerManualStock, returnSaleStock, shortageFor } from './stock'

describe('computeStockDeltas', () => {
  it('comanda nova baixa tudo', () => {
    const deltas = computeStockDeltas([], [{ productId: 'p1', quantity: 2 }, { productId: null, quantity: 5 }])
    expect([...deltas]).toEqual([['p1', 2]])
  })

  it('edição baixa só a diferença', () => {
    const deltas = computeStockDeltas([{ productId: 'p1', quantity: 2 }], [{ productId: 'p1', quantity: 5 }])
    expect(deltas.get('p1')).toBe(3)
  })

  it('reduzir quantidade devolve a diferença', () => {
    const deltas = computeStockDeltas([{ productId: 'p1', quantity: 4 }], [{ productId: 'p1', quantity: 1 }])
    expect(deltas.get('p1')).toBe(-3)
  })

  it('trocar de produto devolve um e baixa o outro', () => {
    const deltas = computeStockDeltas([{ productId: 'p1', quantity: 1 }], [{ productId: 'p2', quantity: 1 }])
    expect(deltas.get('p1')).toBe(-1)
    expect(deltas.get('p2')).toBe(1)
  })

  it('mesmo produto em duas linhas soma', () => {
    const deltas = computeStockDeltas([], [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }])
    expect(deltas.get('p1')).toBe(3)
  })

  it('sem mudança não gera movimento (re-salvar a comanda é inofensivo)', () => {
    const same = [{ productId: 'p1', quantity: 2 }]
    expect(computeStockDeltas(same, same).size).toBe(0)
  })

  it('itens sem produto (serviços) são ignorados', () => {
    expect(computeStockDeltas([{ productId: null, quantity: 3 }], [{ productId: null, quantity: 9 }]).size).toBe(0)
  })

  it('cancelar a comanda devolve tudo', () => {
    const deltas = computeStockDeltas([{ productId: 'p1', quantity: 2 }], [])
    expect(deltas.get('p1')).toBe(-2)
  })
})

function fakeTx(products: Record<string, { trackStock: boolean; stockQty: number }>) {
  const movements: Record<string, unknown>[] = []
  const tx = {
    product: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        products[where.id] ? { id: where.id, trackStock: products[where.id].trackStock } : null
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { stockQty: { increment: number } } }) => {
        products[where.id].stockQty += data.stockQty.increment
        return { stockQty: products[where.id].stockQty }
      })
    },
    stockMovement: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        movements.push(data)
        return data
      })
    },
    saleItem: {
      findMany: vi.fn(async () => [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 }
      ])
    }
  }
  return { tx: tx as unknown as Tx, movements, products }
}

describe('applySaleStockDeltas', () => {
  const params = { tenantId: 't1', actorId: 'u1', note: 'Comanda X' }

  it('baixa o saldo e registra o movimento com saldo após', async () => {
    const { tx, movements, products } = fakeTx({ p1: { trackStock: true, stockQty: 10 } })
    await applySaleStockDeltas(tx, new Map([['p1', 3]]), params)
    expect(products.p1.stockQty).toBe(7)
    expect(movements).toEqual([
      expect.objectContaining({ productId: 'p1', kind: 'SALE', quantity: -3, balanceAfter: 7, note: 'Comanda X' })
    ])
  })

  it('devolução soma ao saldo com tipo SALE_REVERSAL', async () => {
    const { tx, movements, products } = fakeTx({ p1: { trackStock: true, stockQty: 7 } })
    await applySaleStockDeltas(tx, new Map([['p1', -3]]), params)
    expect(products.p1.stockQty).toBe(10)
    expect(movements[0]).toMatchObject({ kind: 'SALE_REVERSAL', quantity: 3, balanceAfter: 10 })
  })

  it('não bloqueia venda sem estoque: o saldo fica negativo', async () => {
    const { tx, products } = fakeTx({ p1: { trackStock: true, stockQty: 1 } })
    await applySaleStockDeltas(tx, new Map([['p1', 4]]), params)
    expect(products.p1.stockQty).toBe(-3)
  })

  it('produto sem controle de estoque não gera movimento', async () => {
    const { tx, movements, products } = fakeTx({ p1: { trackStock: false, stockQty: 0 } })
    await applySaleStockDeltas(tx, new Map([['p1', 2]]), params)
    expect(products.p1.stockQty).toBe(0)
    expect(movements).toHaveLength(0)
  })

  it('ignora produto de outro tenant (não encontrado)', async () => {
    const { tx, movements } = fakeTx({})
    await applySaleStockDeltas(tx, new Map([['p9', 1]]), params)
    expect(movements).toHaveLength(0)
  })
})

describe('returnSaleStock', () => {
  it('devolve cada item de produto da comanda', async () => {
    const { tx, products, movements } = fakeTx({ p1: { trackStock: true, stockQty: 5 }, p2: { trackStock: true, stockQty: 0 } })
    await returnSaleStock(tx, { tenantId: 't1', actorId: null, note: 'Cancelada', saleId: 's1' })
    expect(products.p1.stockQty).toBe(7)
    expect(products.p2.stockQty).toBe(1)
    expect(movements).toHaveLength(2)
  })
})

describe('registerManualStock', () => {
  it('compra soma ao saldo', async () => {
    const { tx, movements, products } = fakeTx({ p1: { trackStock: true, stockQty: 2 } })
    await registerManualStock(tx, { tenantId: 't1', productId: 'p1', actorId: 'u1', kind: 'PURCHASE', quantity: 10, note: ' NF 123 ' })
    expect(products.p1.stockQty).toBe(12)
    expect(movements[0]).toMatchObject({ kind: 'PURCHASE', quantity: 10, balanceAfter: 12, note: 'NF 123' })
  })

  it('ajuste pode ser negativo (perda)', async () => {
    const { tx, products } = fakeTx({ p1: { trackStock: true, stockQty: 5 } })
    await registerManualStock(tx, { tenantId: 't1', productId: 'p1', actorId: null, kind: 'ADJUSTMENT', quantity: -2 })
    expect(products.p1.stockQty).toBe(3)
  })

  it('compra negativa e quantidade zero são recusadas', async () => {
    const { tx } = fakeTx({ p1: { trackStock: true, stockQty: 5 } })
    await expect(registerManualStock(tx, { tenantId: 't1', productId: 'p1', actorId: null, kind: 'PURCHASE', quantity: -1 })).rejects.toThrow()
    await expect(registerManualStock(tx, { tenantId: 't1', productId: 'p1', actorId: null, kind: 'ADJUSTMENT', quantity: 0 })).rejects.toThrow()
  })

  it('produto inexistente: 404', async () => {
    const { tx } = fakeTx({})
    await expect(registerManualStock(tx, { tenantId: 't1', productId: 'nope', actorId: null, kind: 'PURCHASE', quantity: 1 })).rejects.toThrow()
  })
})

describe('shortageFor', () => {
  it('quanto falta para atender o pedido', () => {
    expect(shortageFor(5, 3)).toBe(0)
    expect(shortageFor(2, 5)).toBe(3)
    expect(shortageFor(-1, 2)).toBe(3)
  })
})
