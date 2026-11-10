import { allocateProportionally } from './money'

export interface PackageItemInput {
  /** Preço de tabela do serviço em centavos (null = sem preço). */
  servicePriceCents: number | null
  totalSessions: number
}

/**
 * Valor proporcional de UMA sessão de cada item do pacote, em centavos.
 * O preço do pacote é rateado pelo peso de tabela (preço × sessões) de cada
 * item; sem nenhum preço de tabela, divide igualmente por sessão.
 *
 * Ex.: pacote R$ 300 = 4 cortes (R$ 50) + 2 barbas (R$ 25). Tabela = R$ 250.
 * Cortes recebem R$ 240 → R$ 60/sessão; barbas R$ 60 → R$ 30/sessão.
 */
export function computeSessionValues(packagePriceCents: number, items: PackageItemInput[]): number[] {
  if (items.length === 0) return []
  if (items.some((i) => !Number.isInteger(i.totalSessions) || i.totalSessions < 1)) {
    throw new Error('totalSessions deve ser inteiro >= 1')
  }
  const price = Math.max(0, Math.round(packagePriceCents))

  const hasAnyPrice = items.some((i) => (i.servicePriceCents ?? 0) > 0)
  const weights = items.map((i) => (hasAnyPrice ? (i.servicePriceCents ?? 0) * i.totalSessions : i.totalSessions))

  const perItemTotals = allocateProportionally(price, weights)
  return perItemTotals.map((total, index) => Math.round(total / items[index].totalSessions))
}
