import { describe, it, expect } from 'vitest'
import { agendaLink, parseAgendaParams } from './dashboard-links'
import { ACTIVE_STATUSES } from './dashboard-stats'

const params = (q: string) => new URLSearchParams(q)

describe('agendaLink', () => {
  it('monta vista, dia e filtro', () => {
    expect(agendaLink({ view: 'week', date: '2026-10-13', status: ['SCHEDULED'] })).toBe(
      '/dashboard/agenda?view=week&date=2026-10-13&status=SCHEDULED'
    )
  })

  it('sem status não adiciona o parâmetro', () => {
    expect(agendaLink({ view: 'month', date: '2026-10-13' })).toBe('/dashboard/agenda?view=month&date=2026-10-13')
  })

  it('ida e volta: o que o card gera, a Agenda entende', () => {
    const href = agendaLink({ view: 'week', date: '2026-10-13', status: ACTIVE_STATUSES })
    const parsed = parseAgendaParams(new URL(href, 'http://x').searchParams)
    expect(parsed).toEqual({ view: 'week', date: '2026-10-13', status: [...ACTIVE_STATUSES] })
  })
})

describe('parseAgendaParams — valores inválidos são ignorados', () => {
  it('vista desconhecida', () => {
    expect(parseAgendaParams(params('view=banana'))).toEqual({})
  })

  it('data malformada ou inexistente', () => {
    expect(parseAgendaParams(params('date=13/10/2026'))).toEqual({})
    expect(parseAgendaParams(params('date=2026-02-31'))).toEqual({})
    expect(parseAgendaParams(params('date='))).toEqual({})
  })

  it('status: mantém só os válidos, sem repetir', () => {
    expect(parseAgendaParams(params('status=SCHEDULED,HACK,SCHEDULED,CONFIRMED'))).toEqual({
      status: ['SCHEDULED', 'CONFIRMED'],
    })
    expect(parseAgendaParams(params('status=HACK'))).toEqual({})
  })

  it('sem parâmetros → vazio', () => {
    expect(parseAgendaParams(params(''))).toEqual({})
  })
})
