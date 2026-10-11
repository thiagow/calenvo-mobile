import {
  addCalendarDays,
  calendarDateInZone,
  dayOfWeekFromDateStr,
  tenantCalendarDayWindow,
} from '@/lib/timezone'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface AppointmentRange {
  gte?: Date
  lte?: Date
  /** Vista ∩ período não tem nenhum dia em comum: não há nada a buscar. */
  empty?: boolean
}

/** Aceita "YYYY-MM-DD" ou um instante ISO (clientes antigos) e devolve o dia no fuso do negócio. */
function toCalendarDay(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null
  if (DATE_RE.test(value)) return value
  const instant = new Date(value)
  return Number.isNaN(instant.getTime()) ? null : calendarDateInZone(instant, timeZone)
}

/** Primeiro/último dia (calendário) da janela da vista: dia, semana (seg–dom) ou mês. */
function viewWindow(view: string, day: string): { first: string; last: string } | null {
  switch (view) {
    case 'day':
      return { first: day, last: day }
    case 'week': {
      const dow = dayOfWeekFromDateStr(day) // 0 = domingo
      const first = addCalendarDays(day, dow === 0 ? -6 : 1 - dow)
      return { first, last: addCalendarDays(first, 6) }
    }
    case 'month': {
      const first = `${day.slice(0, 8)}01`
      const nextMonth = addCalendarDays(first, 31).slice(0, 8) + '01'
      return { first, last: addCalendarDays(nextMonth, -1) }
    }
    default:
      return null // list / timeline: sem janela própria
  }
}

/**
 * Janela de datas da listagem de agendamentos.
 *
 * É a INTERSEÇÃO entre a janela da vista (dia/semana/mês em torno de
 * `currentDate`) e o período escolhido nos filtros (`dateFrom`/`dateTo`). Antes,
 * a vista vencia e o período era descartado. As vistas lista/timeline não têm
 * janela própria: só o período, ou — sem período — de hoje em diante (a menos
 * que `includePast`), para não carregar o histórico inteiro.
 *
 * Tudo em dias de calendário do negócio; só no fim vira instante, com
 * `tenantCalendarDayWindow`, para o fim do dia e a noite (21h–24h BRT) caírem
 * no dia certo independentemente do fuso do servidor.
 */
export function resolveAppointmentRange(params: {
  view?: string | null
  currentDate?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  includePast?: boolean
  timeZone: string
  now?: Date
}): AppointmentRange {
  const { view, timeZone, includePast = false, now = new Date() } = params

  let first: string | null = DATE_RE.test(params.dateFrom ?? '') ? params.dateFrom! : null
  let last: string | null = DATE_RE.test(params.dateTo ?? '') ? params.dateTo! : null

  const anchor = toCalendarDay(params.currentDate, timeZone)
  const window = view && anchor ? viewWindow(view, anchor) : null
  if (window) {
    first = first && first > window.first ? first : window.first
    last = last && last < window.last ? last : window.last
  } else if (!first && !last && !includePast && (view === 'list' || view === 'timeline')) {
    first = calendarDateInZone(now, timeZone)
  }

  if (first && last && first > last) return { empty: true }

  return {
    ...(first && { gte: tenantCalendarDayWindow(timeZone, first).start }),
    ...(last && { lte: tenantCalendarDayWindow(timeZone, last).end }),
  }
}
