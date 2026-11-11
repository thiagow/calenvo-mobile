import { allocateProportionally } from './money'

export interface RevenueItem {
  productId: string | null
  totalCents: number
}

/**
 * Uma comanda tem um único recebível (e uma categoria), mas pode misturar
 * serviço e produto. Para o relatório, reparte um valor (recebimento ou total
 * da comanda) entre os itens pelo peso de cada um e separa a parte de produto.
 *
 * Sem item de produto devolve tudo como "other": comandas antigas continuam
 * classificadas exatamente como antes. A soma é sempre o valor original.
 */
export function splitRevenueByKind(amountCents: number, items: RevenueItem[]): { productCents: number; otherCents: number } {
  if (!items.some((i) => i.productId)) return { productCents: 0, otherCents: amountCents }
  const shares = allocateProportionally(
    amountCents,
    items.map((i) => i.totalCents)
  )
  const productCents = items.reduce((sum, item, index) => sum + (item.productId ? shares[index] : 0), 0)
  return { productCents, otherCents: amountCents - productCents }
}
