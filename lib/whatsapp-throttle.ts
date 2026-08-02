const MIN_STEP_MS = 1000
const MAX_STEP_MS = 4000

/**
 * Passo aleatório (1-4s) entre duas mensagens da MESMA conta de WhatsApp.
 * Um intervalo fixo é, por si só, um padrão detectável por heurísticas
 * anti-spam — o objetivo aqui é não parecer um bot enviando em lote.
 */
export function randomStepMs(): number {
  return MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS)
}

/** Formata milissegundos como string de segundos aceita pelo parâmetro `delay` do QStash (ex.: "3s"). */
export function msToQstashDelay(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))}s`
}
