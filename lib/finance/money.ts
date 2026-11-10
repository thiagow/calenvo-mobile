/**
 * Dinheiro no Módulo Financeiro: sempre centavos inteiros (Int) e percentuais
 * em basis points (10000 = 100%). Ponto flutuante só existe na fronteira
 * (Float legado do schema, input do usuário) e é convertido uma única vez aqui.
 */

export type CurrencyCode = 'BRL' | 'USD'

export const BPS_SCALE = 10_000

/**
 * Converte um valor em reais/dólares (Float legado) para centavos.
 * `toPrecision(15)` remove o ruído binário antes de arredondar
 * (1.005 * 100 = 100.49999999999999 viraria 100 com Math.round puro).
 */
export function toCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.round(Number((value * 100).toPrecision(15)))
}

/** Centavos → unidade (só para exibição ou para gravar em campos Float legados). */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Lê o que o usuário digitou ("1.234,56", "1234,5", "1234.56", "R$ 10") e
 * devolve centavos. Com vírgula presente, ela é o separador decimal (pt-BR) e
 * os pontos são de milhar. Sem vírgula, um único ponto seguido de 1-2 dígitos é
 * decimal. Devolve null se não for um número válido e não negativo.
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned || cleaned.includes('-')) return null

  let normalized: string
  if (cleaned.includes(',')) {
    if ((cleaned.match(/,/g) ?? []).length > 1) return null
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned
  } else {
    normalized = cleaned.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [intPart, decPart = ''] = normalized.split('.')
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'))
}

/** Aplica basis points a um valor em centavos, arredondando para o centavo mais próximo. */
export function applyBps(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / BPS_SCALE)
}

/** "2,5" / "2.5" → 250 bps. Aceita até 2 casas decimais. Null se inválido ou fora de 0–100%. */
export function parsePercentToBps(raw: string): number | null {
  const normalized = raw.replace('%', '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const bps = Math.round(Number(normalized) * 100)
  return bps <= BPS_SCALE ? bps : null
}

/** 250 → "2,5" (sem o símbolo %). */
export function formatBps(bps: number, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bps / 100)
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(cents: number, currency: CurrencyCode = 'BRL', locale?: string): string {
  const resolvedLocale = locale ?? (currency === 'USD' ? 'en-US' : 'pt-BR')
  const key = `${resolvedLocale}:${currency}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency })
    formatters.set(key, formatter)
  }
  return formatter.format(cents / 100)
}

/**
 * Rateia `totalCents` proporcionalmente aos pesos, sem perder nem criar
 * centavo (método do maior resto). Pesos todos zero → divisão igual.
 * A soma do resultado é sempre exatamente `totalCents`.
 */
export function allocateProportionally(totalCents: number, weights: number[]): number[] {
  if (!Number.isInteger(totalCents)) throw new Error('totalCents deve ser inteiro')
  if (weights.length === 0) return []
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) throw new Error('pesos devem ser números não negativos')

  const weightSum = weights.reduce((acc, w) => acc + w, 0)
  const effective = weightSum === 0 ? weights.map(() => 1) : weights
  const effectiveSum = weightSum === 0 ? weights.length : weightSum

  const sign = totalCents < 0 ? -1 : 1
  const absTotal = Math.abs(totalCents)

  const raw = effective.map((w) => (absTotal * w) / effectiveSum)
  const floors = raw.map(Math.floor)
  let remainder = absTotal - floors.reduce((acc, v) => acc + v, 0)

  // Distribui os centavos restantes pelos maiores restos; empate → ordem original.
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (const { index } of order) {
    if (remainder === 0) break
    floors[index] += 1
    remainder -= 1
  }

  return floors.map((v) => v * sign)
}
