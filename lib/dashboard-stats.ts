import { calendarDateInZone, tenantCalendarDayWindow } from '@/lib/timezone'
import { viewWindow } from '@/lib/agenda-range'

/**
 * Status que contam como agendamento "de verdade" nos indicadores do Dashboard
 * (tudo menos cancelado e falta). É também o filtro que os cards aplicam ao
 * abrir a Agenda — assim o número do card é exatamente o que a Agenda mostra.
 */
export const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const

export interface DashboardPeriod {
  /** Dias de calendário do negócio, "YYYY-MM-DD" */
  from: string
  to: string
  /** Instantes UTC que cobrem o dia inteiro [from 00:00, to 23:59:59.999] no fuso do negócio */
  gte: Date
  lte: Date
}

export interface DashboardPeriods {
  today: string
  week: DashboardPeriod
  month: DashboardPeriod
}

function toPeriod(window: { first: string; last: string }, timeZone: string): DashboardPeriod {
  return {
    from: window.first,
    to: window.last,
    gte: tenantCalendarDayWindow(timeZone, window.first).start,
    lte: tenantCalendarDayWindow(timeZone, window.last).end,
  }
}

/**
 * Semana (seg–dom, igual à vista Semana da Agenda) e mês do calendário do
 * NEGÓCIO. Nunca usar `setHours` no servidor: na Netlify o processo roda em UTC
 * e, depois das 21h em São Paulo, "hoje" já viraria o dia seguinte.
 */
export function dashboardPeriods(timeZone: string, now: Date = new Date()): DashboardPeriods {
  const today = calendarDateInZone(now, timeZone)
  const week = viewWindow('week', today)!
  const month = viewWindow('month', today)!
  return { today, week: toPeriod(week, timeZone), month: toPeriod(month, timeZone) }
}
