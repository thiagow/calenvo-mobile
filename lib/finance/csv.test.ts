import { describe, expect, it } from 'vitest'
import { centsToNumber, csvCell, toCsv } from './csv'

describe('csv', () => {
  it('usa vírgula decimal e protege separadores e aspas', () => {
    expect(csvCell(12.5)).toBe('12,5')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell(null)).toBe('')
  })

  it('neutraliza injeção de fórmula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+55 11 99999')).toBe("'+55 11 99999")
    expect(csvCell('@soma')).toBe("'@soma")
  })

  it('começa com BOM e separa linhas com CRLF', () => {
    const out = toCsv([
      ['Receitas', 100],
      ['Despesas', 40.5]
    ])
    expect(out.startsWith('﻿')).toBe(true)
    expect(out.slice(1)).toBe('Receitas;100\r\nDespesas;40,5')
  })

  it('converte centavos sem erro de ponto flutuante', () => {
    expect(centsToNumber(1999)).toBe(19.99)
    expect(centsToNumber(-5)).toBe(-0.05)
  })
})
