/**
 * CSV para planilhas em pt-BR: separador ";" (a vírgula é o separador decimal),
 * BOM UTF-8 (o Excel reconhece acentos) e campos protegidos contra injeção de
 * fórmula (=, +, -, @ no início viram texto).
 */

export type CsvCell = string | number | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvCell): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value).replace('.', ',')
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: CsvCell[][]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
}

/** Centavos → número com 2 casas (a planilha formata a moeda). */
export const centsToNumber = (cents: number) => Math.round(cents) / 100

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
