/**
 * Janela de agendamento de uma agenda: quão longe no futuro (dias) e com quanta
 * antecedência mínima (horas) um cliente pode reservar. Limites validados no
 * servidor — a UI só facilita, nunca é a barreira.
 */

export const DEFAULT_ADVANCE_BOOKING_DAYS = 90
export const MAX_ADVANCE_BOOKING_DAYS = 365
export const DEFAULT_MIN_NOTICE_HOURS = 2
export const MAX_MIN_NOTICE_HOURS = 24 * 30

type WindowResult =
  | { ok: true; advanceBookingDays?: number; minNoticeHours?: number }
  | { ok: false; error: string }

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/**
 * Valida os campos de janela de um body de create/update. Campos ausentes
 * (`undefined`) passam sem alteração — no PUT significa "não mexer".
 */
export function parseBookingWindow(body: {
  advanceBookingDays?: unknown
  minNoticeHours?: unknown
}): WindowResult {
  const { advanceBookingDays, minNoticeHours } = body

  if (advanceBookingDays !== undefined && !isIntegerInRange(advanceBookingDays, 1, MAX_ADVANCE_BOOKING_DAYS)) {
    return { ok: false, error: `Antecedência máxima deve ser um número inteiro de 1 a ${MAX_ADVANCE_BOOKING_DAYS} dias` }
  }
  if (minNoticeHours !== undefined && !isIntegerInRange(minNoticeHours, 0, MAX_MIN_NOTICE_HOURS)) {
    return { ok: false, error: `Antecedência mínima deve ser um número inteiro de 0 a ${MAX_MIN_NOTICE_HOURS} horas` }
  }

  return {
    ok: true,
    ...(advanceBookingDays !== undefined && { advanceBookingDays: advanceBookingDays as number }),
    ...(minNoticeHours !== undefined && { minNoticeHours: minNoticeHours as number }),
  }
}
