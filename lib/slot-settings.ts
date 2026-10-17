/**
 * Como uma agenda oferece horários de início: de quanto em quanto tempo e se aplica o
 * agendamento inteligente. Só muda o que é OFERECIDO para novos agendamentos — o que já
 * foi marcado nunca é afetado. Validado no servidor; a UI só facilita.
 */

/** Passo entre inícios oferecidos. 0 = igual à duração do serviço (grade fixa antiga). */
export const SLOT_INTERVAL_OPTIONS = [0, 15, 30, 60] as const
export const DEFAULT_START_INTERVAL = 30
export const DEFAULT_SMART_SCHEDULING = true

type SlotSettingsResult =
  | { ok: true; startInterval?: number; smartScheduling?: boolean }
  | { ok: false; error: string }

/**
 * Valida os campos de horários de um body de create/update. Campos ausentes
 * (`undefined`) passam sem alteração — no PUT significa "não mexer".
 */
export function parseSlotSettings(body: { startInterval?: unknown; smartScheduling?: unknown }): SlotSettingsResult {
  const { startInterval, smartScheduling } = body

  if (
    startInterval !== undefined &&
    !(typeof startInterval === 'number' && (SLOT_INTERVAL_OPTIONS as readonly number[]).includes(startInterval))
  ) {
    return { ok: false, error: `Intervalo entre horários deve ser ${SLOT_INTERVAL_OPTIONS.join(', ')} (0 = igual à duração do serviço)` }
  }
  if (smartScheduling !== undefined && typeof smartScheduling !== 'boolean') {
    return { ok: false, error: 'Agendamento inteligente deve ser verdadeiro ou falso' }
  }

  return {
    ok: true,
    ...(startInterval !== undefined && { startInterval: startInterval as number }),
    ...(smartScheduling !== undefined && { smartScheduling: smartScheduling as boolean }),
  }
}
