import type { Tx } from './context'
import { badRequest, notFound } from './errors'

/**
 * Estoque de produtos. O saldo em `Product.stockQty` muda sempre junto com um
 * `StockMovement` (livro-razão imutável), na mesma transação do chamador.
 *
 * Venda sem estoque suficiente AVISA mas não bloqueia: uma contagem errada não
 * pode travar o caixa. O saldo pode ficar negativo e a tela de Produtos mostra.
 */

export interface StockLine {
  productId: string | null
  quantity: number
}

/**
 * Variação de quantidade VENDIDA por produto entre dois estados de uma comanda.
 * Positivo = saiu mais produto (baixa); negativo = voltou produto (devolução).
 * `writeSaleContent` recria os itens a cada edição; reconciliar por delta evita
 * baixar em dobro ou perder a baixa.
 */
export function computeStockDeltas(before: StockLine[], after: StockLine[]): Map<string, number> {
  const totals = new Map<string, number>()
  const add = (lines: StockLine[], sign: 1 | -1) => {
    for (const line of lines) {
      if (!line.productId) continue
      totals.set(line.productId, (totals.get(line.productId) ?? 0) + sign * line.quantity)
    }
  }
  add(after, 1)
  add(before, -1)
  for (const [productId, delta] of totals) if (delta === 0) totals.delete(productId)
  return totals
}

interface ApplyParams {
  tenantId: string
  actorId: string | null
  note: string
}

/** Aplica deltas de venda (positivo = baixa) nos produtos que controlam estoque. */
export async function applySaleStockDeltas(tx: Tx, deltas: Map<string, number>, params: ApplyParams) {
  for (const [productId, delta] of deltas) {
    const product = await tx.product.findFirst({
      where: { id: productId, userId: params.tenantId },
      select: { id: true, trackStock: true }
    })
    if (!product || !product.trackStock) continue

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockQty: { increment: -delta } },
      select: { stockQty: true }
    })
    await tx.stockMovement.create({
      data: {
        userId: params.tenantId,
        productId,
        kind: delta > 0 ? 'SALE' : 'SALE_REVERSAL',
        quantity: -delta,
        balanceAfter: updated.stockQty,
        note: params.note,
        createdById: params.actorId
      }
    })
  }
}

/** Devolve ao estoque tudo o que a comanda baixou (comanda cancelada). */
export async function returnSaleStock(tx: Tx, params: ApplyParams & { saleId: string }) {
  const items = await tx.saleItem.findMany({
    where: { saleId: params.saleId, productId: { not: null } },
    select: { productId: true, quantity: true }
  })
  await applySaleStockDeltas(tx, computeStockDeltas(items, []), params)
}

export type ManualStockKind = 'INITIAL' | 'PURCHASE' | 'ADJUSTMENT'

/**
 * Entrada ou ajuste manual. `quantity` é assinada: compra positiva; ajuste pode
 * ser negativo (perda). Zero não é um movimento.
 */
export async function registerManualStock(
  tx: Tx,
  params: {
    tenantId: string
    productId: string
    actorId: string | null
    kind: ManualStockKind
    quantity: number
    note?: string | null
  }
) {
  if (!Number.isInteger(params.quantity) || params.quantity === 0) throw badRequest('Informe uma quantidade diferente de zero')
  if (params.kind !== 'ADJUSTMENT' && params.quantity < 0) throw badRequest('Entrada de estoque precisa ser positiva')

  const product = await tx.product.findFirst({ where: { id: params.productId, userId: params.tenantId }, select: { id: true } })
  if (!product) throw notFound('Produto')

  const updated = await tx.product.update({
    where: { id: params.productId },
    data: { stockQty: { increment: params.quantity } },
    select: { stockQty: true }
  })
  return tx.stockMovement.create({
    data: {
      userId: params.tenantId,
      productId: params.productId,
      kind: params.kind,
      quantity: params.quantity,
      balanceAfter: updated.stockQty,
      note: params.note?.trim() || null,
      createdById: params.actorId
    }
  })
}

/** Produto com estoque abaixo do necessário para a quantidade pedida (aviso, não bloqueio). */
export function shortageFor(stockQty: number, requested: number): number {
  return Math.max(0, requested - stockQty)
}
