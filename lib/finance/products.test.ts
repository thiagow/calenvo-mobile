import { describe, expect, it, vi } from 'vitest'
import type { Tx } from './context'
import { createProduct, removeProduct, updateProduct } from './products'
import { productCreateSchema, productUpdateSchema, saleItemSchema, stockAdjustSchema } from './schemas'

function fakeTx(opts: { duplicate?: boolean; sold?: number } = {}) {
  const calls = { created: null as Record<string, unknown> | null, deleted: false, deactivated: false, movements: [] as Record<string, unknown>[] }
  let stock = 0
  const row = () => ({ id: 'p1', name: 'Pomada', priceCents: 4_000, stockQty: stock, isActive: true })
  const tx = {
    product: {
      findFirst: vi.fn(async ({ where }: { where: { name?: unknown; id?: unknown } }) => {
        if (where.name) return opts.duplicate ? { id: 'other' } : null // checagem de nome duplicado
        return { id: 'p1', trackStock: true }
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        calls.created = data
        return { id: 'p1' }
      }),
      findUniqueOrThrow: vi.fn(async () => row()),
      update: vi.fn(async ({ data }: { data: { stockQty?: { increment: number }; isActive?: boolean } }) => {
        if (data.stockQty) stock += data.stockQty.increment
        if (data.isActive === false) calls.deactivated = true
        return { ...row(), stockQty: stock }
      }),
      delete: vi.fn(async () => {
        calls.deleted = true
      })
    },
    stockMovement: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        calls.movements.push(data)
        return { id: 'm1', ...data }
      })
    },
    saleItem: { count: vi.fn(async () => opts.sold ?? 0) },
    financeCategory: { findUnique: vi.fn(async () => ({ id: 'cat-products' })) }
  }
  return { tx: tx as unknown as Tx, calls }
}

const input = (over: Record<string, unknown> = {}) =>
  productCreateSchema.parse({ name: '  Pomada  ', priceCents: 4_000, ...over })

describe('createProduct', () => {
  it('limpa o nome e grava preço e custo', async () => {
    const { tx, calls } = fakeTx()
    await createProduct(tx, { tenantId: 't1', actorId: 'u1', data: input({ costCents: 1_500, sku: ' ' }) })
    expect(calls.created).toMatchObject({ userId: 't1', name: 'Pomada', priceCents: 4_000, costCents: 1_500, sku: null })
  })

  it('saldo inicial vira um movimento INITIAL', async () => {
    const { tx, calls } = fakeTx()
    await createProduct(tx, { tenantId: 't1', actorId: 'u1', data: input({ initialStock: 12 }) })
    expect(calls.movements).toEqual([expect.objectContaining({ kind: 'INITIAL', quantity: 12, balanceAfter: 12 })])
  })

  it('sem controle de estoque o saldo inicial é ignorado', async () => {
    const { tx, calls } = fakeTx()
    await createProduct(tx, { tenantId: 't1', actorId: 'u1', data: input({ trackStock: false, initialStock: 12, minStockQty: 3 }) })
    expect(calls.movements).toHaveLength(0)
    expect(calls.created).toMatchObject({ trackStock: false, minStockQty: null })
  })

  it('nome repetido (sem diferenciar maiúsculas) dá conflito legível', async () => {
    const { tx } = fakeTx({ duplicate: true })
    await expect(createProduct(tx, { tenantId: 't1', actorId: null, data: input() })).rejects.toThrow('Já existe um produto com este nome')
  })
})

describe('updateProduct', () => {
  it('desligar o controle de estoque zera o mínimo', async () => {
    const { tx } = fakeTx()
    await updateProduct(tx, { tenantId: 't1', productId: 'p1', data: productUpdateSchema.parse({ trackStock: false }) })
    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trackStock: false, minStockQty: null }) }))
  })
})

describe('removeProduct', () => {
  it('produto já vendido é desativado, não apagado (preserva o histórico)', async () => {
    const { tx, calls } = fakeTx({ sold: 4 })
    await expect(removeProduct(tx, { tenantId: 't1', productId: 'p1' })).resolves.toEqual({ deleted: false, deactivated: true })
    expect(calls.deactivated).toBe(true)
    expect(calls.deleted).toBe(false)
  })

  it('produto nunca vendido é apagado', async () => {
    const { tx, calls } = fakeTx({ sold: 0 })
    await expect(removeProduct(tx, { tenantId: 't1', productId: 'p1' })).resolves.toEqual({ deleted: true, deactivated: false })
    expect(calls.deleted).toBe(true)
  })
})

describe('schemas', () => {
  it('item de produto não pode trazer serviço nem pacote', () => {
    const base = { description: 'Pomada', quantity: 1, unitPriceCents: 4_000 }
    expect(saleItemSchema.safeParse({ ...base, productId: 'p1' }).success).toBe(true)
    expect(saleItemSchema.safeParse({ ...base, productId: 'p1', serviceId: 's1' }).success).toBe(false)
    expect(saleItemSchema.safeParse({ ...base, productId: 'p1', clientPackageItemId: 'c1' }).success).toBe(false)
    expect(saleItemSchema.safeParse({ ...base, serviceId: 's1' }).success).toBe(true)
  })

  it('campo desconhecido é recusado (estrito)', () => {
    expect(productCreateSchema.safeParse({ name: 'X', priceCents: 1, stockQty: 999 }).success).toBe(false)
    expect(productUpdateSchema.safeParse({ stockQty: 999 }).success).toBe(false)
  })

  it('preço negativo e nome vazio são recusados', () => {
    expect(productCreateSchema.safeParse({ name: 'X', priceCents: -1 }).success).toBe(false)
    expect(productCreateSchema.safeParse({ name: '   ', priceCents: 1 }).success).toBe(false)
  })

  it('ajuste de estoque aceita negativo; o tipo é restrito', () => {
    expect(stockAdjustSchema.safeParse({ kind: 'ADJUSTMENT', quantity: -2 }).success).toBe(true)
    expect(stockAdjustSchema.safeParse({ kind: 'SALE', quantity: 1 }).success).toBe(false)
  })
})
