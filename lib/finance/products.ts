import type { z } from 'zod'
import { systemCategoryId, type Tx } from './context'
import { conflict, notFound } from './errors'
import type { productCreateSchema, productUpdateSchema } from './schemas'
import { registerManualStock } from './stock'

/** Catálogo de produtos. Sempre escopado por tenant; o saldo só muda via StockMovement. */

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  sku: true,
  category: true,
  priceCents: true,
  costCents: true,
  isActive: true,
  trackStock: true,
  stockQty: true,
  minStockQty: true
} as const

export type ProductDto = {
  id: string
  name: string
  description: string | null
  sku: string | null
  category: string | null
  priceCents: number
  costCents: number | null
  isActive: boolean
  trackStock: boolean
  stockQty: number
  minStockQty: number | null
}

const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

export async function listProducts(tx: Tx, tenantId: string, opts: { includeInactive?: boolean; q?: string | null } = {}) {
  const q = opts.q?.trim()
  return tx.product.findMany({
    where: {
      userId: tenantId,
      ...(!opts.includeInactive && { isActive: true }),
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] })
    },
    select: PRODUCT_SELECT,
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  })
}

async function assertUniqueName(tx: Tx, tenantId: string, name: string, exceptId?: string) {
  const existing = await tx.product.findFirst({
    where: { userId: tenantId, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true }
  })
  if (existing) throw conflict('Já existe um produto com este nome')
}

export async function createProduct(
  tx: Tx,
  params: { tenantId: string; actorId: string | null; data: z.infer<typeof productCreateSchema> }
) {
  const { tenantId, actorId, data } = params
  const name = data.name.trim()
  await assertUniqueName(tx, tenantId, name)
  // Garante a categoria de receita "Produtos" (tenants criados antes dela existir).
  await systemCategoryId(tx, tenantId, 'products')

  const product = await tx.product.create({
    data: {
      userId: tenantId,
      name,
      description: clean(data.description),
      sku: clean(data.sku),
      category: clean(data.category),
      priceCents: data.priceCents,
      costCents: data.costCents ?? null,
      trackStock: data.trackStock,
      minStockQty: data.trackStock ? data.minStockQty ?? null : null
    },
    select: { id: true }
  })
  if (data.trackStock && data.initialStock && data.initialStock > 0) {
    await registerManualStock(tx, {
      tenantId,
      productId: product.id,
      actorId,
      kind: 'INITIAL',
      quantity: data.initialStock,
      note: 'Saldo inicial'
    })
  }
  return tx.product.findUniqueOrThrow({ where: { id: product.id }, select: PRODUCT_SELECT })
}

export async function updateProduct(
  tx: Tx,
  params: { tenantId: string; productId: string; data: z.infer<typeof productUpdateSchema> }
) {
  const { tenantId, productId, data } = params
  const current = await tx.product.findFirst({ where: { id: productId, userId: tenantId }, select: { id: true, trackStock: true } })
  if (!current) throw notFound('Produto')
  if (data.name !== undefined) await assertUniqueName(tx, tenantId, data.name.trim(), productId)

  const trackStock = data.trackStock ?? current.trackStock
  return tx.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: clean(data.description) }),
      ...(data.sku !== undefined && { sku: clean(data.sku) }),
      ...(data.category !== undefined && { category: clean(data.category) }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.costCents !== undefined && { costCents: data.costCents }),
      ...(data.trackStock !== undefined && { trackStock: data.trackStock }),
      ...(data.minStockQty !== undefined || !trackStock ? { minStockQty: trackStock ? data.minStockQty ?? null : null } : {}),
      ...(data.isActive !== undefined && { isActive: data.isActive })
    },
    select: PRODUCT_SELECT
  })
}

/**
 * Produto com venda no histórico não pode ser apagado (perderia o vínculo do
 * relatório): é desativado e some das telas de venda. Sem histórico, é apagado.
 */
export async function removeProduct(tx: Tx, params: { tenantId: string; productId: string }) {
  const product = await tx.product.findFirst({ where: { id: params.productId, userId: params.tenantId }, select: { id: true } })
  if (!product) throw notFound('Produto')
  const sold = await tx.saleItem.count({ where: { productId: params.productId } })
  if (sold > 0) {
    await tx.product.update({ where: { id: params.productId }, data: { isActive: false } })
    return { deleted: false, deactivated: true }
  }
  await tx.product.delete({ where: { id: params.productId } })
  return { deleted: true, deactivated: false }
}

export async function listStockMovements(tx: Tx, tenantId: string, productId: string, limit = 50) {
  const product = await tx.product.findFirst({ where: { id: productId, userId: tenantId }, select: { id: true } })
  if (!product) throw notFound('Produto')
  const rows = await tx.stockMovement.findMany({
    where: { productId, userId: tenantId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    select: {
      id: true,
      kind: true,
      quantity: true,
      balanceAfter: true,
      note: true,
      createdAt: true,
      createdBy: { select: { name: true } }
    }
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    quantity: r.quantity,
    balanceAfter: r.balanceAfter,
    note: r.note,
    createdAt: r.createdAt,
    createdBy: r.createdBy?.name ?? null
  }))
}
