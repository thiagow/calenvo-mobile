import { ACTIVE_STATUSES } from '@/lib/dashboard-stats'

type AgendaStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export const AGENDA_VIEWS = ['day', 'week', 'month', 'list', 'timeline'] as const
export type AgendaViewParam = (typeof AGENDA_VIEWS)[number]

const ALL_STATUSES: readonly AgendaStatus[] = [...ACTIVE_STATUSES, 'CANCELLED', 'NO_SHOW']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** "2026-02-31" casa o formato mas não existe: o JS normaliza para março, então comparo ida e volta. */
function isRealCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

/** Link da Agenda já na vista, no dia e com o filtro de status certos. */
export function agendaLink(params: { view: AgendaViewParam; date: string; status?: readonly AgendaStatus[] }): string {
  const query = new URLSearchParams({ view: params.view, date: params.date })
  if (params.status?.length) query.set('status', params.status.join(','))
  return `/dashboard/agenda?${query.toString()}`
}

export interface AgendaInitialParams {
  view?: AgendaViewParam
  date?: string
  status?: AgendaStatus[]
}

/** Lê view/date/status da URL da Agenda; qualquer valor inválido é ignorado (nunca quebra a tela). */
export function parseAgendaParams(search: { get(name: string): string | null }): AgendaInitialParams {
  const view = search.get('view')
  const date = search.get('date')
  const status = search.get('status')

  const validDate = date && isRealCalendarDate(date) ? date : undefined
  const statuses = status
    ? Array.from(new Set(status.split(',').filter((s): s is AgendaStatus => (ALL_STATUSES as readonly string[]).includes(s))))
    : []

  return {
    ...((AGENDA_VIEWS as readonly string[]).includes(view ?? '') && { view: view as AgendaViewParam }),
    ...(validDate && { date: validDate }),
    ...(statuses.length > 0 && { status: statuses }),
  }
}
