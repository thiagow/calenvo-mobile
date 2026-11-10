import { describe, it, expect } from 'vitest'
import {
  toCents,
  fromCents,
  parseMoneyInput,
  applyBps,
  parsePercentToBps,
  formatBps,
  formatMoney,
  allocateProportionally
} from './money'

describe('toCents', () => {
  it('converte Float legado sem ruído binário', () => {
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(49.9)).toBe(4990)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0)).toBe(0)
  })

  it('null/undefined/NaN viram null', () => {
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
    expect(toCents(Number.NaN)).toBeNull()
  })

  it('fromCents é o inverso para exibição', () => {
    expect(fromCents(4990)).toBe(49.9)
  })
})

describe('parseMoneyInput', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,5', 123450],
    ['R$ 10', 1000],
    ['10,00', 1000],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['0,99', 99]
  ])('"%s" → %i centavos', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected)
  })

  it.each(['', 'abc', '-10', '1,2,3', '10,999'])('"%s" é inválido', (input) => {
    expect(parseMoneyInput(input)).toBeNull()
  })
})

describe('basis points', () => {
  it('applyBps arredonda para o centavo mais próximo', () => {
    expect(applyBps(10000, 4000)).toBe(4000) // 40% de R$ 100
    expect(applyBps(3333, 3333)).toBe(1111)
    expect(applyBps(999, 250)).toBe(25) // 2,5% de 9,99 = 0,24975
  })

  it('parsePercentToBps aceita vírgula e ponto, até 100%', () => {
    expect(parsePercentToBps('2,5')).toBe(250)
    expect(parsePercentToBps('40%')).toBe(4000)
    expect(parsePercentToBps('3.99')).toBe(399)
    expect(parsePercentToBps('100')).toBe(10000)
    expect(parsePercentToBps('100,01')).toBeNull()
    expect(parsePercentToBps('abc')).toBeNull()
  })

  it('formatBps', () => {
    expect(formatBps(250)).toBe('2,5')
    expect(formatBps(4000)).toBe('40')
  })
})

describe('formatMoney', () => {
  it('formata conforme a moeda do tenant', () => {
    expect(formatMoney(123456, 'BRL').replace(/\s/g, ' ')).toBe('R$ 1.234,56')
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
  })
})

describe('allocateProportionally', () => {
  it('a soma é sempre exata (sem perder centavo)', () => {
    const parts = allocateProportionally(1000, [1, 1, 1])
    expect(parts).toEqual([334, 333, 333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it('respeita os pesos', () => {
    expect(allocateProportionally(30000, [20000, 5000])).toEqual([24000, 6000])
  })

  it('pesos zerados → divisão igual', () => {
    expect(allocateProportionally(100, [0, 0, 0])).toEqual([34, 33, 33])
  })

  it('valores negativos (estornos) mantêm a soma', () => {
    const parts = allocateProportionally(-1000, [1, 2])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000)
  })

  it('rejeita total não inteiro e peso negativo', () => {
    expect(() => allocateProportionally(10.5, [1])).toThrow()
    expect(() => allocateProportionally(10, [1, -1])).toThrow()
  })

  it('lista vazia', () => {
    expect(allocateProportionally(100, [])).toEqual([])
  })
})
