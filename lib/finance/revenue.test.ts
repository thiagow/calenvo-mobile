import { describe, expect, it } from 'vitest'
import { splitRevenueByKind } from './revenue'

describe('splitRevenueByKind', () => {
  it('comanda só de serviço fica igual: tudo "other"', () => {
    expect(splitRevenueByKind(10_000, [{ productId: null, totalCents: 10_000 }])).toEqual({ productCents: 0, otherCents: 10_000 })
  })

  it('comanda sem itens (dado legado) fica igual', () => {
    expect(splitRevenueByKind(5_000, [])).toEqual({ productCents: 0, otherCents: 5_000 })
  })

  it('serviço + produto: pagamento total reparte pelo valor de cada item', () => {
    const items = [
      { productId: null, totalCents: 8_000 },
      { productId: 'p1', totalCents: 2_000 }
    ]
    expect(splitRevenueByKind(10_000, items)).toEqual({ productCents: 2_000, otherCents: 8_000 })
  })

  it('pagamento parcial reparte proporcionalmente, sem perder centavo', () => {
    const items = [
      { productId: null, totalCents: 7_000 },
      { productId: 'p1', totalCents: 3_000 }
    ]
    const split = splitRevenueByKind(1_001, items)
    expect(split.productCents + split.otherCents).toBe(1_001)
    expect(split.productCents).toBe(300)
  })

  it('estorno (valor negativo) reparte com o mesmo critério', () => {
    const items = [
      { productId: null, totalCents: 8_000 },
      { productId: 'p1', totalCents: 2_000 }
    ]
    expect(splitRevenueByKind(-10_000, items)).toEqual({ productCents: -2_000, otherCents: -8_000 })
  })

  it('comanda só de produto vai toda para produto', () => {
    expect(splitRevenueByKind(4_500, [{ productId: 'p1', totalCents: 4_500 }])).toEqual({ productCents: 4_500, otherCents: 0 })
  })

  it('item de produto com desconto total (valor 0) não leva receita', () => {
    const items = [
      { productId: null, totalCents: 5_000 },
      { productId: 'p1', totalCents: 0 }
    ]
    expect(splitRevenueByKind(5_000, items)).toEqual({ productCents: 0, otherCents: 5_000 })
  })
})
