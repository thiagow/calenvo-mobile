import { describe, it, expect } from 'vitest'
import {
  addCalendarDays,
  calendarDateInZone,
  dayOfWeekFromDateStr,
  tenantCalendarDayWindow,
  tenantDayWindow,
  todayInZone,
  wallTimeToInstant,
} from '@/lib/timezone'

const SP = 'America/Sao_Paulo' // UTC-3, sem horário de verão desde 2019

describe('tenantDayWindow', () => {
  it('janela de hoje (daysAhead=0) em America/Sao_Paulo', () => {
    // 2026-01-15T15:00:00Z = 2026-01-15 12:00 local (SP = UTC-3)
    const now = new Date('2026-01-15T15:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(start.toISOString()).toBe('2026-01-15T03:00:00.000Z') // 00:00:00 local
    expect(end.toISOString()).toBe('2026-01-16T02:59:59.999Z') // 23:59:59.999 local
  })

  it('janela de amanhã (daysAhead=1)', () => {
    const now = new Date('2026-01-15T15:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 1, now)

    expect(start.toISOString()).toBe('2026-01-16T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-17T02:59:59.999Z')
  })

  it('usa o dia LOCAL do tenant, não o dia UTC, perto da virada de meia-noite UTC', () => {
    // 2026-01-15T02:00:00Z = 2026-01-14 23:00 local — ainda dia 14 em SP
    const now = new Date('2026-01-15T02:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(start.toISOString()).toBe('2026-01-14T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-15T02:59:59.999Z')
  })

  it('janela dura exatamente 24h menos 1ms', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})

// A suíte roda com TZ=UTC (vitest.config.ts), igual à produção no Netlify.
// Se alguém voltar a montar horário de parede com métodos locais do processo,
// estes testes reprovam.
describe('wallTimeToInstant', () => {
  it('converte hora de parede do negócio para o instante correto (GMT-3)', () => {
    // 15:00 em São Paulo = 18:00Z. Era exatamente essa a defasagem que fazia a
    // grade exibir como livre um horário já ocupado.
    expect(wallTimeToInstant('2026-08-21', '15:00', SP).toISOString()).toBe('2026-08-21T18:00:00.000Z')
  })

  it('não depende do fuso do processo', () => {
    expect(wallTimeToInstant('2026-08-21', '15:00', 'UTC').toISOString()).toBe('2026-08-21T15:00:00.000Z')
  })

  it('resolve corretamente do outro lado do meridiano', () => {
    expect(wallTimeToInstant('2026-08-21', '09:00', 'Asia/Tokyo').toISOString()).toBe('2026-08-21T00:00:00.000Z')
  })

  it('acerta um fuso com horário de verão ativo', () => {
    // Nova York em agosto está em EDT (UTC-4), não EST (UTC-5).
    expect(wallTimeToInstant('2026-08-21', '12:00', 'America/New_York').toISOString()).toBe('2026-08-21T16:00:00.000Z')
    // E em janeiro, EST.
    expect(wallTimeToInstant('2026-01-21', '12:00', 'America/New_York').toISOString()).toBe('2026-01-21T17:00:00.000Z')
  })

  it('meia-noite do dia seguinte não escorrega pro dia anterior', () => {
    expect(wallTimeToInstant('2026-08-21', '00:00', SP).toISOString()).toBe('2026-08-21T03:00:00.000Z')
  })
})

describe('tenantCalendarDayWindow', () => {
  it('cobre o dia de calendário do negócio, não o dia UTC', () => {
    const { start, end } = tenantCalendarDayWindow(SP, '2026-08-21')
    expect(start.toISOString()).toBe('2026-08-21T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-08-22T02:59:59.999Z')
  })

  it('inclui um agendamento noturno que, em UTC, cai no dia seguinte', () => {
    const { start, end } = tenantCalendarDayWindow(SP, '2026-08-21')
    // 22:00 em São Paulo = 01:00Z do dia 22 — a janela por dia UTC perdia isso.
    const nightAppointment = wallTimeToInstant('2026-08-21', '22:00', SP)
    expect(nightAppointment >= start && nightAppointment <= end).toBe(true)
  })
})

describe('dayOfWeekFromDateStr', () => {
  it('não desloca o dia da semana por causa de fuso horário', () => {
    // 21/07/2026 é uma terça-feira (dia 2). `new Date("2026-07-21").getDay()`
    // resolvia pra segunda num processo em GMT-3 — foi o que fez a IA achar a
    // agenda fechada num dia em que ela estava aberta.
    expect(dayOfWeekFromDateStr('2026-07-21')).toBe(2)
    expect(dayOfWeekFromDateStr('2026-08-21')).toBe(5)
  })
})

describe('addCalendarDays', () => {
  it('atravessa fim de mês e ano', () => {
    expect(addCalendarDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('calendarDateInZone / todayInZone', () => {
  it('resolve o dia de calendário no fuso do negócio, não em UTC', () => {
    // 01:00Z do dia 22 ainda é dia 21 em São Paulo.
    expect(calendarDateInZone(new Date('2026-08-22T01:00:00.000Z'), SP)).toBe('2026-08-21')
    expect(calendarDateInZone(new Date('2026-08-22T01:00:00.000Z'), 'UTC')).toBe('2026-08-22')
  })

  it('todayInZone aceita um instante de referência', () => {
    expect(todayInZone(SP, new Date('2026-08-22T01:00:00.000Z'))).toBe('2026-08-21')
  })
})
