import { describe, it, expect } from 'vitest'
import { buildGoogleCalendarUrl, buildIcs, formatCalendarUtc } from '@/lib/calendar-links'

// 05/11/2026 14:00 em São Paulo (UTC-3) = 17:00Z
const START = new Date('2026-11-05T17:00:00.000Z')

const base = {
  uid: 'appt_123',
  title: 'Corte — Barbearia Dom',
  startUtc: START,
  durationMin: 45,
}

describe('formatCalendarUtc', () => {
  it('formata em UTC com zero à esquerda', () => {
    expect(formatCalendarUtc(new Date('2026-01-02T03:04:05.000Z'))).toBe('20260102T030405Z')
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('monta início e fim em UTC a partir da duração', () => {
    const url = new URL(buildGoogleCalendarUrl(base))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261105T170000Z/20261105T174500Z')
  })

  it('atravessa a virada de dia e de mês', () => {
    const url = new URL(
      buildGoogleCalendarUrl({ ...base, startUtc: new Date('2026-11-30T23:30:00.000Z'), durationMin: 60 }),
    )
    expect(url.searchParams.get('dates')).toBe('20261130T233000Z/20261201T003000Z')
  })

  it('preserva acentos e omite campos vazios', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...base, location: null, timezone: 'America/Sao_Paulo' }))
    expect(url.searchParams.get('text')).toBe('Corte — Barbearia Dom')
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo')
    expect(url.searchParams.has('location')).toBe(false)
    expect(url.searchParams.has('details')).toBe(false)
  })
})

describe('buildIcs', () => {
  it('gera VEVENT com UID estável e horários em UTC', () => {
    const ics = buildIcs(base)
    expect(ics).toContain('UID:appt_123@calenvo.com\r\n')
    expect(ics).toContain('DTSTART:20261105T170000Z\r\n')
    expect(ics).toContain('DTEND:20261105T174500Z\r\n')
    expect(ics).toContain('STATUS:CONFIRMED\r\n')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('marca como TENTATIVE quando aguardando confirmação', () => {
    expect(buildIcs({ ...base, tentative: true })).toContain('STATUS:TENTATIVE\r\n')
  })

  it('escapa vírgula, ponto e vírgula, barra e quebra de linha', () => {
    const ics = buildIcs({ ...base, location: 'Rua A, 10; Sala 2', description: 'linha 1\nlinha 2 \\ fim' })
    expect(ics).toContain('LOCATION:Rua A\\, 10\\; Sala 2\r\n')
    expect(ics).toContain('DESCRIPTION:linha 1\\nlinha 2 \\\\ fim\r\n')
  })

  it('dobra linhas longas em até 75 octetos sem partir caracteres multibyte', () => {
    const ics = buildIcs({ ...base, description: 'ção '.repeat(60) })
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    // Desdobrando (CRLF + espaço) o texto original é recuperado inteiro.
    expect(ics.replace(/\r\n /g, '')).toContain(`DESCRIPTION:${'ção '.repeat(60)}`)
  })
})
