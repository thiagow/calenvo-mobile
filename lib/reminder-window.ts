const HOUR_MS = 60 * 60 * 1000
const HALF_HOUR_MS = 30 * 60 * 1000

export interface ReminderWindow {
  /** Inclusivo */
  start: Date
  /** Exclusivo — por isso as janelas de rodadas seguidas se encaixam sem sobrepor */
  end: Date
}

/**
 * Janela de agendamentos que recebem lembrete na rodada de `now`, para um
 * lembrete configurado `reminderHours` antes.
 *
 * O cron roda de hora em hora. Ancorar a janela em `now` (como era antes) fazia
 * a borda deslizar com o atraso de cada execução: dois ciclos seguidos podiam
 * se sobrepor (lembrete duplicado) ou deixar um vão (lembrete perdido). Aqui a
 * janela parte da HORA CHEIA e é aberta no fim: [h+N-30min, h+N+30min), então
 * rodadas consecutivas cobrem a linha do tempo exatamente uma vez.
 */
export function reminderWindow(now: Date, reminderHours: number): ReminderWindow {
  const hourStart = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS
  const target = hourStart + reminderHours * HOUR_MS
  return { start: new Date(target - HALF_HOUR_MS), end: new Date(target + HALF_HOUR_MS) }
}
